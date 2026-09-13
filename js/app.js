// app.js — Coordinación Académica
//
// Flujo: login → carrera → materia → alumno → resumen y descargas.
// Es de SOLO LECTURA: esta app nunca escribe nada en Firestore.
//
// Cada materia declara en firebase-config.js su "carrera" (para agrupar en
// la interfaz) y su "esquema" de calificación:
//   'bloques'   → Bases Culinarias            → calculo.js / reporte.js
//   'parciales' → Origen de las Cocinas,
//                 Expresión Oral y Escrita    → calculo-parciales.js / reporte-parciales.js
//
// El grupo no se elige a mano: como cada materia tiene un solo grupo, se
// selecciona el primero automáticamente (ver cargarGrupoYAlumnos).

import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  CARRERAS, materiasDeCarrera, MATERIA_LOGIN,
  authDe, dbDe, sitioDe, esquemaDe, asignaturaDe,
} from "./firebase-config.js";

import { calcularBloque } from "./calculo.js";
import {
  reporteExamenAlumno, reporteAsistenciaAlumno,
  reporteParticipacionAlumno, reportePracticasAlumno, reporteConcentradoAlumno,
} from "./reporte.js";

import { calcularParcial, calcularCuatrimestre } from "./calculo-parciales.js";
import {
  reporteExamenParcial, reporteAsistenciaParcial,
  reporteTareasYParticipacionAlumno, reporteConcentradoParcial,
} from "./reporte-parciales.js";

const auth = authDe(MATERIA_LOGIN);

// ---------- Estado ----------
let carreraActiva = CARRERAS[0] || null;
let materiaActiva = null;
let grupoActivo = null;
let alumnosCache = [];
let bancosCache = {};

let datosAlumno = null;
let bloquesAlumno = null;       // esquema 'bloques'
let resultadosAlumno = null;    // esquema 'parciales'
let totalCuatrimestre = null;   // esquema 'parciales'

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);

function on(id, evento, fn) {
  const el = $(id);
  if (el) el.addEventListener(evento, fn);
}

function db() { return dbDe(materiaActiva); }
function esquema() { return esquemaDe(materiaActiva); }

function mostrarMsg(texto, esError) {
  const msg = $('descarga-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.className = 'msg ' + (esError ? 'msg-error' : 'msg-ok');
  msg.hidden = false;
  setTimeout(() => { msg.hidden = true; }, esError ? 6000 : 3000);
}

// ---------- Login ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    $('login-screen').hidden = true;
    $('app-screen').hidden = false;
    poblarCarreras();
    poblarMaterias();
    ajustarPorEsquema();
    await cargarGrupoYAlumnos();
  } else {
    $('login-screen').hidden = false;
    $('app-screen').hidden = true;
  }
});

on('login-form', 'submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const pass = $('login-pass').value;
  const errorEl = $('login-error');
  errorEl.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
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

// ---------- Carrera ----------
function poblarCarreras() {
  const select = $('carrera-select');
  if (select.options.length > 0) return;
  CARRERAS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });
  select.value = carreraActiva;
}

on('carrera-select', 'change', async (e) => {
  carreraActiva = e.target.value;
  poblarMaterias();
  ocultarPanel();
  ajustarPorEsquema();
  await cargarGrupoYAlumnos();
});

// ---------- Materia ----------
function poblarMaterias() {
  const select = $('materia-select');
  select.innerHTML = '';
  const lista = materiasDeCarrera(carreraActiva);
  lista.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.nombre;
    select.appendChild(opt);
  });
  materiaActiva = lista[0]?.id || null;
  select.value = materiaActiva;
}

on('materia-select', 'change', async (e) => {
  materiaActiva = e.target.value;
  ocultarPanel();
  ajustarPorEsquema();
  await cargarGrupoYAlumnos();
});

// Adapta las etiquetas y opciones que cambian entre un esquema y otro.
function ajustarPorEsquema() {
  const esParciales = esquema() === 'parciales';
  const periodo = $('descarga-periodo');
  const labelPeriodo = document.querySelector('label[for="descarga-periodo"]');
  const btnPracticas = $('btn-descargar-practicas');
  const txtParticipacion = $('txt-participacion');

  if (esParciales) {
    labelPeriodo.textContent = 'Parcial (para examen y asistencia)';
    periodo.innerHTML = `
      <option value="p1">Parcial 1</option>
      <option value="p2">Parcial 2</option>
      <option value="final">Examen Final</option>`;
    txtParticipacion.textContent = 'Tareas y Participación';
    // Estas materias no llevan un catálogo de prácticas aparte (el examen
    // práctico del Parcial 2 ya aparece dentro de ese parcial).
    btnPracticas.hidden = true;
  } else {
    labelPeriodo.textContent = 'Bloque (para examen y asistencia)';
    periodo.innerHTML = `
      <option value="1">Bloque 1</option>
      <option value="2">Bloque 2</option>
      <option value="3">Bloque 3</option>`;
    txtParticipacion.textContent = 'Participación';
    btnPracticas.hidden = false;
  }
}

// ---------- Grupo (automático) y alumnos ----------
async function cargarGrupoYAlumnos() {
  const selectAlumno = $('alumno-select');
  const vacio = $('alumno-empty');
  selectAlumno.innerHTML = '<option value="">Selecciona…</option>';
  vacio.hidden = true;
  alumnosCache = [];
  grupoActivo = null;
  if (!materiaActiva) return;

  let gruposSnap;
  try {
    gruposSnap = await getDocs(query(collection(db(), 'grupos'), orderBy('nombre')));
  } catch (err) {
    console.error('No se pudieron leer los grupos:', err);
    vacio.textContent = 'No se pudo conectar con esta materia.';
    vacio.hidden = false;
    return;
  }

  const primero = gruposSnap.docs[0];
  if (!primero) {
    vacio.textContent = 'Esta materia todavía no tiene grupos registrados.';
    vacio.hidden = false;
    return;
  }
  grupoActivo = primero.id;
  $('grupo-select').innerHTML = `<option value="${primero.id}">${primero.data().nombre || ''}</option>`;

  let alumnosSnap;
  try {
    alumnosSnap = await getDocs(query(collection(db(), 'grupos', grupoActivo, 'alumnos'), orderBy('nombre')));
  } catch (err) {
    // Sin este aviso, un fallo de permisos dejaba el selector vacío y sin
    // ninguna pista de qué había pasado.
    console.error('No se pudieron leer los alumnos:', err);
    vacio.textContent = `No se pudo leer la lista de alumnos (${err.code || err.message}).`;
    vacio.hidden = false;
    return;
  }

  alumnosCache = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  alumnosCache.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.nombre;
    selectAlumno.appendChild(opt);
  });

  if (alumnosCache.length === 0) {
    vacio.textContent = 'Esta materia todavía no tiene alumnos registrados.';
    vacio.hidden = false;
  }
}

function nombreDelGrupo() {
  const select = $('grupo-select');
  return select.options[select.selectedIndex]?.textContent || 'Sin grupo';
}

function alumnoActual() {
  const id = $('alumno-select').value;
  return alumnosCache.find(a => a.id === id);
}

function ocultarPanel() {
  $('alumno-panel').hidden = true;
}

on('alumno-select', 'change', async (e) => {
  if (!e.target.value) { ocultarPanel(); return; }
  await mostrarAlumno(e.target.value);
});

// ---------- Datos del alumno ----------
async function datosBloques(alumnoId) {
  const base = ['grupos', grupoActivo, 'alumnos', alumnoId];
  const [act, evalu, ens, asis, exa, int, ajus] = await Promise.all([
    getDocs(collection(db(), ...base, 'actividades')).catch(() => null),
    getDocs(collection(db(), ...base, 'evaluaciones')).catch(() => null),
    getDocs(collection(db(), ...base, 'ensayos')).catch(() => null),
    getDocs(collection(db(), ...base, 'asistencias')).catch(() => null),
    getDocs(collection(db(), ...base, 'examenes')).catch(() => null),
    getDocs(collection(db(), ...base, 'intentos')).catch(() => null),
    getDocs(collection(db(), ...base, 'ajustes')).catch(() => null),
  ]);
  const aMapa = (snap) => {
    const o = {};
    if (snap) snap.docs.forEach(d => { o[d.id] = d.data(); });
    return o;
  };
  return {
    idsActividades: act ? act.docs.map(d => d.id) : [],
    ensayos: aMapa(ens),
    practicas: evalu ? evalu.docs.map(d => d.data()) : [],
    asistencias: asis ? asis.docs.map(d => d.data()) : [],
    examenes: aMapa(exa),
    intentos: aMapa(int),
    ajustes: aMapa(ajus),
  };
}

async function datosParciales(alumnoId) {
  const base = ['grupos', grupoActivo, 'alumnos', alumnoId];
  const [tar, part, asis, unifP1, unifP2, exaP1, exaP2, exaF, pracP2, pE1, pE2, pEF] = await Promise.all([
    getDocs(collection(db(), ...base, 'tareas')).catch(() => null),
    getDocs(collection(db(), ...base, 'participaciones')).catch(() => null),
    getDocs(collection(db(), ...base, 'asistencias')).catch(() => null),
    getDoc(doc(db(), ...base, 'uniformes', 'p1')).catch(() => null),
    getDoc(doc(db(), ...base, 'uniformes', 'p2')).catch(() => null),
    getDoc(doc(db(), ...base, 'examenes', 'p1')).catch(() => null),
    getDoc(doc(db(), ...base, 'examenes', 'p2')).catch(() => null),
    getDoc(doc(db(), ...base, 'examenes', 'final')).catch(() => null),
    getDoc(doc(db(), ...base, 'practico', 'p2')).catch(() => null),
    getDoc(doc(db(), ...base, 'proyecto', 'entrega1')).catch(() => null),
    getDoc(doc(db(), ...base, 'proyecto', 'entrega2')).catch(() => null),
    getDoc(doc(db(), ...base, 'proyecto', 'entregaFinal')).catch(() => null),
  ]);
  const dato = (s) => (s && s.exists() ? s.data() : null);
  return {
    tareas: tar ? tar.docs.map(d => d.data()) : [],
    participaciones: part ? part.docs.map(d => d.data()) : [],
    asistencias: asis ? asis.docs.map(d => d.data()) : [],
    uniformes: { p1: dato(unifP1), p2: dato(unifP2) },
    examenes: { p1: dato(exaP1), p2: dato(exaP2), final: dato(exaF) },
    practico: { p2: dato(pracP2) },
    proyecto: { entrega1: dato(pE1), entrega2: dato(pE2), entregaFinal: dato(pEF) },
  };
}

async function mostrarAlumno(alumnoId) {
  const panel = $('alumno-panel');
  const resumen = $('alumno-resumen');
  panel.hidden = false;
  resumen.innerHTML = '<p class="empty-inline">Cargando…</p>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (esquema() === 'parciales') {
    datosAlumno = await datosParciales(alumnoId);
    resultadosAlumno = {
      p1: calcularParcial('p1', datosAlumno),
      p2: calcularParcial('p2', datosAlumno),
      final: calcularParcial('final', datosAlumno),
    };
    totalCuatrimestre = calcularCuatrimestre(resultadosAlumno);
    bloquesAlumno = null;
    resumen.innerHTML = htmlResumenParciales();
  } else {
    datosAlumno = await datosBloques(alumnoId);
    bloquesAlumno = [1, 2, 3].map(b => calcularBloque(b, datosAlumno));
    resultadosAlumno = null;
    totalCuatrimestre = null;
    resumen.innerHTML = htmlResumenBloques();
  }
}

function fila(etiqueta, pts, tope, extra) {
  return `<div class="res-row">
    <span>${etiqueta}${extra ? ` <span class="res-extra">${extra}</span>` : ''}</span>
    <strong>${pts.toFixed(1)} / ${tope}</strong>
  </div>`;
}

function htmlResumenBloques() {
  const cards = bloquesAlumno.map(x => `
    <div class="res-card">
      <h4>Bloque ${x.bloque}</h4>
      ${fila('Participación', x.participacion.pts, x.participacion.tope, `${x.participacion.hechas}/${x.participacion.deTotal} actividades`)}
      ${fila('Ensayos', x.ensayos.pts, x.ensayos.tope, `${x.ensayos.entregados}/${x.ensayos.deTotal} bitácoras`)}
      ${fila('Prácticas de cocina', x.practicas.pts, x.practicas.tope, `${x.practicas.cuantas}/${x.practicas.deTotal} prácticas`)}
      ${fila('Asistencia', x.asistencia.pts, x.asistencia.tope, `${x.asistencia.clases}/${x.asistencia.deTotal} clases`)}
      ${fila('Examen', x.examen.pts, x.examen.tope, x.examen.calificacion !== null ? `${x.examen.calificacion}/10` : 'sin presentar')}
      <div class="res-row res-total"><span>Total</span><strong>${x.total.toFixed(1)} / 100 pts</strong></div>
    </div>`).join('');
  const promedio = bloquesAlumno.reduce((s, x) => s + x.total, 0) / 3 / 10;
  return `${cards}<div class="score-display">Promedio: ${promedio.toFixed(1)} / 10</div>`;
}

function htmlResumenParciales() {
  const NOMBRES = { p1: 'Parcial 1', p2: 'Parcial 2', final: 'Examen Final' };
  const cards = ['p1', 'p2', 'final'].map(p => {
    const r = resultadosAlumno[p];
    let cuerpo;
    if (p === 'final') {
      cuerpo = fila('Examen', r.examen.pts, r.examen.tope)
        + fila('Proyecto', r.proyecto.pts, r.proyecto.tope)
        + fila('Tareas y Participación', r.tareasParticipacion.pts, r.tareasParticipacion.tope)
        + fila('Asistencia', r.asistencia.pts, r.asistencia.tope);
    } else if (p === 'p2') {
      cuerpo = fila('Examen escrito', r.examenEscrito.pts, r.examenEscrito.tope)
        + fila('Examen práctico', r.practico.pts, r.practico.tope)
        + fila('Tareas', r.tareas.pts, r.tareas.tope)
        + fila('Participación', r.participacion.pts, r.participacion.tope, `${r.participacion.cantidad}/${r.participacion.meta}`)
        + fila('Asistencia', r.asistencia.pts, r.asistencia.tope)
        + fila('Uniformes', r.uniformes.pts, r.uniformes.tope);
    } else {
      cuerpo = fila('Examen', r.examen.pts, r.examen.tope)
        + fila('Tareas', r.tareas.pts, r.tareas.tope)
        + fila('Participación', r.participacion.pts, r.participacion.tope, `${r.participacion.cantidad}/${r.participacion.meta}`)
        + fila('Asistencia', r.asistencia.pts, r.asistencia.tope)
        + fila('Uniformes', r.uniformes.pts, r.uniformes.tope);
    }
    return `<div class="res-card"><h4>${NOMBRES[p]}</h4>${cuerpo}
      <div class="res-row res-total"><span>Total</span><strong>${r.total.toFixed(1)} / 100 pts</strong></div>
    </div>`;
  }).join('');
  return `${cards}<div class="score-display">Calificación final del cuatrimestre: ${(totalCuatrimestre / 10).toFixed(1)} / 10</div>`;
}

// ---------- Descargas ----------
async function cargarBanco(periodo) {
  const clave = `${materiaActiva}-${periodo}`;
  if (bancosCache[clave]) return bancosCache[clave];
  const archivo = esquema() === 'parciales'
    ? `examen_${periodo}.json`
    : `examen_bloque${periodo}.json`;
  const res = await fetch(`${sitioDe(materiaActiva)}data/${archivo}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se encontró el banco de reactivos (HTTP ${res.status})`);
  const banco = await res.json();
  bancosCache[clave] = banco;
  return banco;
}

on('btn-descargar-examen', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno) return;
  const periodo = $('descarga-periodo').value;
  try {
    const [snap, banco] = await Promise.all([
      getDoc(doc(db(), 'grupos', grupoActivo, 'alumnos', alumno.id, 'intentos', String(periodo))),
      cargarBanco(periodo),
    ]);
    const intento = snap.exists() ? snap.data() : null;
    if (esquema() === 'parciales') {
      await reporteExamenParcial({ nombreGrupo: nombreDelGrupo(), alumno, asignatura: asignaturaDe(materiaActiva), parcial: periodo, intento, banco });
    } else {
      await reporteExamenAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloque: periodo, intento, banco });
    }
  } catch (err) {
    console.error(err);
    mostrarMsg('No se pudo generar el examen: ' + (err.message || err), true);
  }
});

on('btn-descargar-asistencia', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno) return;
  const periodo = $('descarga-periodo').value;
  try {
    if (esquema() === 'parciales') {
      if (!resultadosAlumno) return;
      const dias = (datosAlumno.asistencias || [])
        .filter(a => a.parcial === periodo)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      await reporteAsistenciaParcial({
        nombreGrupo: nombreDelGrupo(), alumno, asignatura: asignaturaDe(materiaActiva),
        parcial: periodo, r: resultadosAlumno[periodo], diasOrdenados: dias,
      });
    } else {
      if (!bloquesAlumno) return;
      const bloque = parseInt(periodo, 10);
      const r = bloquesAlumno.find(x => x.bloque === bloque);
      const diasOrdenados = (datosAlumno.asistencias || [])
        .filter(a => Number(a.bloque) === bloque)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      await reporteAsistenciaAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloque, r: { ...r, diasOrdenados } });
    }
  } catch (err) {
    console.error(err);
    mostrarMsg('No se pudo generar la asistencia: ' + (err.message || err), true);
  }
});

on('btn-descargar-participacion', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno) return;
  try {
    if (esquema() === 'parciales') {
      if (!resultadosAlumno) return;
      await reporteTareasYParticipacionAlumno({
        nombreGrupo: nombreDelGrupo(), alumno,
        asignatura: asignaturaDe(materiaActiva), resultados: resultadosAlumno,
      });
    } else {
      if (!bloquesAlumno) return;
      await reporteParticipacionAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloques: bloquesAlumno });
    }
  } catch (err) {
    console.error(err);
    mostrarMsg('No se pudo generar el reporte: ' + (err.message || err), true);
  }
});

on('btn-descargar-practicas', 'click', async () => {
  if (esquema() === 'parciales') return; // el botón está oculto en ese esquema
  const alumno = alumnoActual();
  if (!alumno || !bloquesAlumno) return;
  try {
    await reportePracticasAlumno({ nombreGrupo: nombreDelGrupo(), alumno, bloques: bloquesAlumno });
  } catch (err) {
    console.error(err);
    mostrarMsg('No se pudo generar el reporte: ' + (err.message || err), true);
  }
});

on('btn-descargar-concentrado', 'click', async () => {
  const alumno = alumnoActual();
  if (!alumno) return;
  try {
    if (esquema() === 'parciales') {
      if (!resultadosAlumno) return;
      await reporteConcentradoParcial({
        nombreGrupo: nombreDelGrupo(), alumno, asignatura: asignaturaDe(materiaActiva),
        resultados: resultadosAlumno, totalCuatrimestre,
      });
    } else {
      if (!datosAlumno) return;
      await reporteConcentradoAlumno({ nombreGrupo: nombreDelGrupo(), alumno, datos: datosAlumno });
    }
  } catch (err) {
    console.error(err);
    mostrarMsg('No se pudo generar el concentrado: ' + (err.message || err), true);
  }
});
