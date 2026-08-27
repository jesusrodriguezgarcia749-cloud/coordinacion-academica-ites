// app.js — Coordinación Académica
// Login → elige materia → elige grupo → elige alumno → ve su resumen y
// descarga lo que necesite (examen, asistencia, participación, prácticas,
// o el concentrado general). Es de SOLO LECTURA: esta app nunca escribe
// nada en Firestore.

import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { MATERIAS, MATERIA_LOGIN, authDe, dbDe, sitioDe } from "./firebase-config.js";
import { calcularBloque } from "./calculo.js";
import {
  reporteExamenAlumno, reporteAsistenciaAlumno,
  reporteParticipacionAlumno, reportePracticasAlumno, reporteConcentradoAlumno,
} from "./reporte.js";

const auth = authDe(MATERIA_LOGIN);

let materiaActiva = MATERIAS[0]?.id || null;
let grupoActivo = null;
let alumnosCache = [];
let bancosExamenCache = {}; // por materia+bloque

function on(id, evento, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evento, fn);
  return el;
}

function db() {
  return dbDe(materiaActiva);
}

// ---------- LOGIN ----------
onAuthStateChanged(auth, async user => {
  if (user) {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('app-screen').hidden = false;
    poblarMaterias();
    await cargarGrupos();
  } else {
    document.getElementById('login-screen').hidden = false;
    document.getElementById('app-screen').hidden = true;
  }
});

on('login-form', 'submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error('Error de login:', err.code, err.message);
    const MENSAJES = {
      'auth/user-not-found': 'Ese correo no está dado de alta.',
      'auth/wrong-password': 'La contraseña no coincide.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/invalid-email': 'Ese correo no tiene un formato válido.',
      'auth/too-many-requests': 'Demasiados intentos fallidos — espera unos minutos.',
      'auth/network-request-failed': 'Falla de conexión a internet.',
    };
    errorEl.textContent = MENSAJES[err.code] || `No se pudo entrar (${err.code || err.message}).`;
    errorEl.hidden = false;
  }
});

on('btn-logout', 'click', () => signOut(auth));

// ---------- MATERIA ----------
function poblarMaterias() {
  const select = document.getElementById('materia-select');
  if (select.options.length > 0) return; // ya poblado
  MATERIAS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nombre;
    select.appendChild(opt);
  });
  select.value = materiaActiva;
}

on('materia-select', 'change', async (e) => {
  materiaActiva = e.target.value;
  grupoActivo = null;
  ocultarPanelAlumno();
  await cargarGrupos();
});

// ---------- GRUPO ----------
async function cargarGrupos() {
  const select = document.getElementById('grupo-select');
  select.innerHTML = '<option value="">— Elige un grupo —</option>';
  const snap = await getDocs(query(collection(db(), 'grupos'), orderBy('nombre')));
  snap.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.data().nombre;
    select.appendChild(opt);
  });
}

on('grupo-select', 'change', async (e) => {
  grupoActivo = e.target.value || null;
  ocultarPanelAlumno();
  if (grupoActivo) await cargarAlumnos();
  else poblarSelectAlumnos([]);
});

// ---------- ALUMNO ----------
async function cargarAlumnos() {
  const snap = await getDocs(query(collection(db(), 'grupos', grupoActivo, 'alumnos'), orderBy('nombre')));
  alumnosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  poblarSelectAlumnos(alumnosCache);
}

function poblarSelectAlumnos(lista) {
  const select = document.getElementById('alumno-select');
  select.innerHTML = '<option value="">— Elige un alumno —</option>';
  lista.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nombre;
    select.appendChild(opt);
  });
  const empty = document.getElementById('alumno-empty');
  if (empty) empty.hidden = lista.length > 0 || !!grupoActivo === false ? lista.length > 0 : true;
}

function ocultarPanelAlumno() {
  const panel = document.getElementById('alumno-panel');
  if (panel) panel.hidden = true;
}

on('alumno-select', 'change', async (e) => {
  const alumnoId = e.target.value;
  if (!alumnoId) { ocultarPanelAlumno(); return; }
  await mostrarAlumno(alumnoId);
});

function nombreDelGrupo() {
  const select = document.getElementById('grupo-select');
  return select.options[select.selectedIndex]?.textContent || 'Sin grupo';
}

function alumnoActual() {
  const id = document.getElementById('alumno-select').value;
  return alumnosCache.find(a => a.id === id);
}

// ---------- DATOS DEL ALUMNO (mismo patrón que admin.js) ----------
async function datosDeAlumno(alumnoId) {
  const base = ['grupos', grupoActivo, 'alumnos', alumnoId];
  const [actSnap, evalSnap, ensSnap, asisSnap, exaSnap, intSnap, ajusSnap] = await Promise.all([
    getDocs(collection(db(), ...base, 'actividades')).catch(() => null),
    getDocs(collection(db(), ...base, 'evaluaciones')).catch(() => null),
    getDocs(collection(db(), ...base, 'ensayos')).catch(() => null),
    getDocs(collection(db(), ...base, 'asistencias')).catch(() => null),
    getDocs(collection(db(), ...base, 'examenes')).catch(() => null),
    getDocs(collection(db(), ...base, 'intentos')).catch(() => null),
    getDocs(collection(db(), ...base, 'ajustes')).catch(() => null),
  ]);

  const ensayos = {};
  if (ensSnap) ensSnap.docs.forEach(d => { ensayos[d.id] = d.data(); });
  const examenes = {};
  if (exaSnap) exaSnap.docs.forEach(d => { examenes[d.id] = d.data(); });
  const intentos = {};
  if (intSnap) intSnap.docs.forEach(d => { intentos[d.id] = d.data(); });
  const ajustes = {};
  if (ajusSnap) ajusSnap.docs.forEach(d => { ajustes[d.id] = d.data(); });

  return {
    idsActividades: actSnap ? actSnap.docs.map(d => d.id) : [],
    ensayos,
    practicas: evalSnap ? evalSnap.docs.map(d => d.data()) : [],
    asistencias: asisSnap ? asisSnap.docs.map(d => d.data()) : [],
    examenes,
    intentos,
    ajustes,
  };
}

let datosAlumnoActual = null;
let bloquesAlumnoActual = null;

async function mostrarAlumno(alumnoId) {
  const panel = document.getElementById('alumno-panel');
  const resumen = document.getElementById('alumno-resumen');
  panel.hidden = false;
  resumen.innerHTML = '<p class="empty-inline">Cargando…</p>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  datosAlumnoActual = await datosDeAlumno(alumnoId);
  bloquesAlumnoActual = [1, 2, 3].map(b => calcularBloque(b, datosAlumnoActual));

  const fila = (etiqueta, r, extra) => `
    <div class="res-row">
      <span>${etiqueta}${extra ? ` <small class="res-extra">${extra}</small>` : ''}${r.manual ? ' <small class="res-extra">· ajuste manual</small>' : ''}</span>
      <strong>${r.pts.toFixed(1)} / ${r.tope}</strong>
    </div>`;

  resumen.innerHTML = `
    ${bloquesAlumnoActual.map(x => `
      <div class="res-card">
        <h4>Bloque ${x.bloque}</h4>
        ${fila('Participación', x.participacion, `${x.participacion.hechas}/${x.participacion.deTotal} actividades`)}
        ${fila('Ensayos', x.ensayos, `${x.ensayos.entregados}/${x.ensayos.deTotal} bitácoras`)}
        ${fila('Prácticas de cocina', x.practicas, `${x.practicas.cuantas}/${x.practicas.deTotal} prácticas`)}
        ${fila('Asistencia', x.asistencia, `${x.asistencia.clases}/${x.asistencia.deTotal} clases · ${x.asistencia.conteo.falta} faltas`)}
        ${fila('Examen', x.examen, x.examen.calificacion !== null ? `${x.examen.calificacion}/10 · ${x.examen.origen}` : 'sin presentar')}
        <div class="res-row res-total">
          <span>Total Bloque ${x.bloque}</span>
          <strong>${x.total.toFixed(1)} / 100 pts</strong>
        </div>
      </div>
    `).join('')}
    <div class="score-display">
      Promedio: ${(bloquesAlumnoActual.reduce((s, x) => s + x.total, 0) / 3 / 10).toFixed(1)} / 10
    </div>
  `;
}

// ---------- DESCARGAS ----------
function mostrarMsgDescarga(texto, esError) {
  const msg = document.getElementById('descarga-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.style.color = esError ? '#A63D2F' : '#6B7A5E';
  msg.hidden = false;
  setTimeout(() => { msg.hidden = true; }, esError ? 6000 : 3000);
}

async function cargarBancoExamen(bloque) {
  const clave = `${materiaActiva}-${bloque}`;
  if (bancosExamenCache[clave]) return bancosExamenCache[clave];
  const url = `${sitioDe(materiaActiva)}data/examen_bloque${bloque}.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se encontró el banco de reactivos (HTTP ${res.status})`);
  const banco = await res.json();
  bancosExamenCache[clave] = banco;
  return banco;
}

on('btn-descargar-examen', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno) return;
  const bloque = document.getElementById('descarga-bloque').value;
  try {
    const [snap, banco] = await Promise.all([
      getDoc(doc(db(), 'grupos', grupoActivo, 'alumnos', alumno.id, 'intentos', String(bloque))),
      cargarBancoExamen(bloque),
    ]);
    const intento = snap.exists() ? snap.data() : null;
    await reporteExamenAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloque, intento, banco });
  } catch (err) {
    console.error(err);
    mostrarMsgDescarga('No se pudo generar el examen: ' + (err.message || err), true);
  }
});

on('btn-descargar-asistencia', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno || !bloquesAlumnoActual) return;
  const bloque = parseInt(document.getElementById('descarga-bloque').value, 10);
  const r = bloquesAlumnoActual.find(x => x.bloque === bloque);
  const diasOrdenados = (datosAlumnoActual.asistencias || [])
    .filter(a => Number(a.bloque) === bloque)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  try {
    await reporteAsistenciaAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloque, r: { ...r, diasOrdenados } });
  } catch (err) {
    console.error(err);
    mostrarMsgDescarga('No se pudo generar la asistencia: ' + (err.message || err), true);
  }
});

on('btn-descargar-participacion', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno || !bloquesAlumnoActual) return;
  try {
    await reporteParticipacionAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloques: bloquesAlumnoActual });
  } catch (err) {
    console.error(err);
    mostrarMsgDescarga('No se pudo generar el reporte: ' + (err.message || err), true);
  }
});

on('btn-descargar-practicas', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno || !bloquesAlumnoActual) return;
  try {
    await reportePracticasAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloques: bloquesAlumnoActual });
  } catch (err) {
    console.error(err);
    mostrarMsgDescarga('No se pudo generar el reporte: ' + (err.message || err), true);
  }
});

on('btn-descargar-concentrado', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno || !datosAlumnoActual) return;
  try {
    await reporteConcentradoAlumno({ nombreGrupo: nombreDelGrupo(), alumno, datos: datosAlumnoActual });
  } catch (err) {
    console.error(err);
    mostrarMsgDescarga('No se pudo generar el concentrado: ' + (err.message || err), true);
  }
});
