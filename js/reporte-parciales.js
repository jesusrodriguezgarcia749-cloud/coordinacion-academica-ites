// reporte-parciales.js — Coordinación Académica
// Genera los reportes descargables (PDF vía "Imprimir → Guardar como PDF")
// para materias con esquema de PARCIALES (Origen de las Cocinas, Expresión
// Oral y Escrita) — paralelo a reporte.js, que es solo para Bases
// Culinarias (esquema de Bloques). Mismo diseño institucional en ambos,
// para que lo que descargue Coordinación se vea igual de oficial sin
// importar la materia.

import { NOMBRES_PARCIAL, NOMBRES_ENTREGA_PROYECTO } from "./calculo-parciales.js";

const ESCUELA_BASE = {
  nombre: 'Instituto Tecnológico de Estudios Superiores René Descartes',
  carrera: 'Licenciatura en Artes Culinarias y Negocios Gastronómicos',
  docente: 'Chef Jesús Rodríguez García',
  logo: 'assets/escudo.png',
};

const ETIQUETA_TIPO_REACTIVO = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero o falso',
  relacionar: 'Relaciona columnas',
};

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function hoy() {
  return new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function badge(calif) {
  const c = Number(calif);
  const clase = c >= 8 ? 'b-ok' : (c >= 6 ? 'b-riesgo' : 'b-repro');
  return `<span class="badge ${clase}">${c.toFixed(1)}</span>`;
}

function barajarConSemilla(arr, semilla) {
  const copia = [...arr];
  let s = semilla;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function semillaDe(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 233280;
  return h || 1;
}

// Mismos estilos que reporte.js, para que ambas materias se vean idénticas
// en el diseño del PDF — solo cambia el contenido.
const ESTILOS = `
  @page { size: letter; margin: 12mm; }
  *{box-sizing:border-box;}
  body{font-family:'Public Sans',-apple-system,Arial,sans-serif; color:#231F1A; margin:0; padding:20px; background:#F4EFE4;}
  .hoja{background:#fff; max-width:840px; margin:0 auto 28px; padding:34px 38px; box-shadow:0 2px 14px rgba(0,0,0,.08);}
  .encabezado{display:flex; align-items:center; gap:18px; border-bottom:3px solid #A63D2F; padding-bottom:16px;}
  .encabezado img{width:70px; height:70px; object-fit:contain; flex-shrink:0;}
  .enc-texto{flex:1;}
  .escuela{font-family:'Fraunces',Georgia,serif; font-size:1rem; font-weight:700; line-height:1.25; margin:0 0 3px;}
  .carrera{font-size:.75rem; color:#5C544A; margin:0 0 2px;}
  .asignatura{font-size:.8rem; font-weight:600; color:#A63D2F; margin:0;}
  .enc-sello{text-align:right; font-size:.6rem; color:#8A8177; text-transform:uppercase; letter-spacing:.08em; line-height:1.6;}
  h1{font-family:'Fraunces',Georgia,serif; font-size:1.25rem; margin:20px 0 3px;}
  .subtitulo{font-size:.78rem; color:#5C544A; margin:0 0 20px;}
  .datos{display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #E0D9CB; border-radius:6px; overflow:hidden; margin-bottom:24px;}
  .dato{padding:9px 11px; border-right:1px solid #E0D9CB;}
  .dato:last-child{border-right:0;}
  .dato-etq{font-size:.58rem; text-transform:uppercase; letter-spacing:.07em; color:#8A8177; margin-bottom:3px;}
  .dato-val{font-size:.82rem; font-weight:600;}
  h2{font-family:'Fraunces',Georgia,serif; font-size:.95rem; margin:24px 0 9px; padding-bottom:5px; border-bottom:1.5px solid #C98A2C;}
  table{width:100%; border-collapse:collapse; font-size:.72rem;}
  thead th{background:#231F1A; color:#F7F3EA; padding:7px; text-align:left; font-weight:600; font-size:.64rem; text-transform:uppercase; letter-spacing:.03em;}
  thead th.num{text-align:center;}
  tbody td{padding:6px 7px; border-bottom:1px solid #EDE7DA;}
  tbody td.num{text-align:center; font-variant-numeric:tabular-nums;}
  tbody tr:nth-child(even){background:#FBF8F1;}
  tbody td.alumno{font-weight:600;}
  .total-col{font-weight:700; color:#4A5D3C;}
  tr.fila-total td{background:#F0EADC; font-weight:700; border-top:2px solid #231F1A;}
  .badge{display:inline-block; padding:2px 7px; border-radius:99px; font-size:.64rem; font-weight:700;}
  .b-ok{background:rgba(74,93,60,.14); color:#4A5D3C;}
  .b-riesgo{background:rgba(201,138,44,.18); color:#8A5E12;}
  .b-repro{background:rgba(166,61,47,.14); color:#A63D2F;}
  .asis-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(60px,1fr)); gap:5px; margin-top:8px;}
  .asis-dia{border-radius:5px; padding:6px 3px; text-align:center; color:#fff; font-size:.62rem; font-weight:700;}
  .a-presente{background:#6B7A5E;} .a-justificado{background:#4A7FA5;}
  .a-retardo{background:#C9A22C;} .a-falta{background:#A63D2F;}
  .leyenda{display:flex; gap:14px; font-size:.64rem; color:#5C544A; margin:9px 0 4px; flex-wrap:wrap;}
  .leyenda span{display:flex; align-items:center; gap:5px;}
  .lg{width:9px; height:9px; border-radius:2px; display:inline-block;}
  .firmas{display:flex; gap:56px; margin-top:46px; justify-content:center;}
  .firma{text-align:center; flex:1; max-width:230px;}
  .firma-linea{border-top:1px solid #231F1A; margin-bottom:5px;}
  .firma-nombre{font-size:.75rem; font-weight:700;}
  .firma-cargo{font-size:.64rem; color:#5C544A;}
  .pie{margin-top:32px; padding-top:11px; border-top:1px solid #E0D9CB; display:flex; justify-content:space-between; font-size:.6rem; color:#8A8177;}
  .barra-imprimir{
    position:sticky; top:0; z-index:10; background:#231F1A; color:#F7F3EA;
    padding:12px 20px; display:flex; justify-content:space-between; align-items:center;
    max-width:840px; margin:0 auto 16px; border-radius:8px; font-size:.85rem;
  }
  .barra-imprimir button{
    background:#C98A2C; color:#231F1A; border:0; padding:9px 20px;
    border-radius:99px; font-weight:700; font-size:.85rem; cursor:pointer;
  }
  .ex-reactivo{border:1.5px solid #E0D9CB; border-radius:8px; padding:14px 16px; margin-bottom:14px;}
  .ex-reactivo-ok{border-left:5px solid #4A5D3C;}
  .ex-reactivo-mal{border-left:5px solid #A63D2F;}
  .ex-reactivo-head{display:flex; align-items:center; gap:10px; margin-bottom:8px;}
  .ex-num{font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:.85rem; color:#8A8177;}
  .ex-tipo{font-size:.62rem; text-transform:uppercase; letter-spacing:.05em; color:#8A8177; background:#F0EADC; padding:2px 8px; border-radius:99px;}
  .ex-resultado{margin-left:auto; font-size:.72rem; font-weight:700;}
  .ex-reactivo-ok .ex-resultado{color:#4A5D3C;}
  .ex-reactivo-mal .ex-resultado{color:#A63D2F;}
  .ex-pregunta{font-size:.85rem; font-weight:600; margin:0 0 8px;}
  .ex-opciones{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px;}
  .ex-opciones li{font-size:.78rem; padding:6px 10px; border-radius:6px; border:1px solid #E0D9CB;}
  .ex-opcion-correcta{border-color:#4A5D3C !important; background:rgba(74,93,60,.10);}
  .ex-opcion-elegida-ok{border-color:#4A5D3C !important; background:rgba(74,93,60,.18); font-weight:700;}
  .ex-opcion-elegida-mal{border-color:#A63D2F !important; background:rgba(166,61,47,.10); font-weight:700;}
  .ex-explicacion{font-size:.74rem; color:#5C544A; margin:8px 0 0; padding-top:8px; border-top:1px dashed #E0D9CB;}
  .ex-tabla-relacionar{margin-top:4px;}
  .ex-tabla-relacionar th, .ex-tabla-relacionar td{font-size:.72rem;}
  .ex-ok{color:#4A5D3C; font-weight:700;}
  .ex-mal{color:#A63D2F; font-weight:700;}
  .ex-sin-entregar{padding:14px 16px; border:1.5px dashed #E0D9CB; border-radius:8px; color:#8A8177; font-size:.8rem; text-align:center; margin-bottom:14px;}
  @media print{
    body{background:#fff; padding:0;}
    .hoja{box-shadow:none; margin:0; padding:0; max-width:none;}
    .barra-imprimir{display:none;}
    .salto{page-break-before:always;}
  }
`;

function encabezado(logoDataUrl, asignatura) {
  return `<div class="encabezado">
    <img src="${logoDataUrl || ESCUELA_BASE.logo}" alt="Escudo institucional">
    <div class="enc-texto">
      <p class="escuela">${esc(ESCUELA_BASE.nombre)}</p>
      <p class="carrera">${esc(ESCUELA_BASE.carrera)}</p>
      <p class="asignatura">${esc(asignatura)}</p>
    </div>
    <div class="enc-sello">Coordinación<br>Académica</div>
  </div>`;
}

const FIRMAS = `<div class="firmas">
    <div class="firma"><div class="firma-linea"></div>
      <div class="firma-nombre">${esc(ESCUELA_BASE.docente)}</div>
      <div class="firma-cargo">Docente de la asignatura</div></div>
    <div class="firma"><div class="firma-linea"></div>
      <div class="firma-nombre">Coordinación Académica</div>
      <div class="firma-cargo">Sello y firma</div></div>
  </div>`;

function pie() {
  return `<div class="pie">
    <span>Coordinación Académica · ITES René Descartes</span>
    <span>Emitido el ${hoy()}</span>
  </div>`;
}

function abrirVentana(titulo, cuerpo) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>${ESTILOS}</style></head><body>
<div class="barra-imprimir">
  <span>Revisa el reporte y usa el botón para imprimirlo o guardarlo como PDF.</span>
  <button onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
${cuerpo}
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Tu navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e intenta de nuevo.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

async function logoComoDataUrl() {
  try {
    const res = await fetch(ESCUELA_BASE.logo);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.onerror = () => r(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ---------- 1. EXAMEN RESUELTO (por Parcial) ----------
function detalleReactivoHTML(r, numero, intento) {
  const g = intento.respuestas ? intento.respuestas[r.id] : undefined;
  const semilla = semillaDe(r.id + intento.semilla);
  let cuerpo = '';
  let correcto;

  if (r.tipo === 'relacionar') {
    correcto = r.pares.every((_, i) => g && g[i] === i);
    const derechas = barajarConSemilla(r.pares.map((p, i) => ({ t: p.derecha, i })), semilla);
    cuerpo = `<table class="ex-tabla-relacionar">
      <thead><tr><th>Columna</th><th>Respuesta del alumno</th><th>Respuesta correcta</th></tr></thead>
      <tbody>${r.pares.map((p, i) => {
        const elegidoIdx = g ? g[i] : undefined;
        const elegido = elegidoIdx !== undefined ? (derechas.find(d => d.i === elegidoIdx)?.t ?? '—') : '— sin responder —';
        const ok = elegidoIdx === i;
        return `<tr>
          <td>${esc(p.izquierda)}</td>
          <td class="${ok ? 'ex-ok' : 'ex-mal'}">${esc(elegido)}</td>
          <td>${esc(p.derecha)}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } else {
    correcto = g === r.correcta;
    const ops = barajarConSemilla(r.opciones.map((o, i) => ({ t: o, i })), semilla);
    cuerpo = `<ul class="ex-opciones">${ops.map(o => {
      const esElegida = g === o.i;
      const esCorrecta = o.i === r.correcta;
      let clase = '';
      if (esCorrecta) clase = 'ex-opcion-correcta';
      if (esElegida && !esCorrecta) clase = 'ex-opcion-elegida-mal';
      if (esElegida && esCorrecta) clase = 'ex-opcion-elegida-ok';
      return `<li class="${clase}">${esc(o.t)}${esElegida ? ' <strong>(elegida por el alumno)</strong>' : ''}${esCorrecta ? ' ✓ correcta' : ''}</li>`;
    }).join('')}</ul>`;
    if (g === undefined || g === null) {
      cuerpo = `<p class="ex-mal" style="font-size:.78rem;">— El alumno no contestó esta pregunta —</p>` + cuerpo;
    }
  }

  return `<div class="ex-reactivo ${correcto ? 'ex-reactivo-ok' : 'ex-reactivo-mal'}">
    <div class="ex-reactivo-head">
      <span class="ex-num">${numero}</span>
      <span class="ex-tipo">${ETIQUETA_TIPO_REACTIVO[r.tipo] || ''}</span>
      <span class="ex-resultado">${correcto ? '✓ Correcta' : '✗ Incorrecta'}</span>
    </div>
    <p class="ex-pregunta">${esc(r.pregunta)}</p>
    ${cuerpo}
    ${r.explicacion ? `<p class="ex-explicacion"><strong>Explicación:</strong> ${esc(r.explicacion)}</p>` : ''}
  </div>`;
}

export async function reporteExamenParcial({ nombreGrupo, alumno, asignatura, parcial, intento, banco }) {
  const logo = await logoComoDataUrl();
  const nombreParcial = NOMBRES_PARCIAL[parcial] || parcial;

  if (!intento || intento.estado !== 'entregado') {
    abrirVentana(`Examen — ${alumno.nombre}`, `<div class="hoja">
      ${encabezado(logo, asignatura)}
      <h1>Examen resuelto — ${esc(nombreParcial)}</h1>
      <p class="subtitulo">${esc(alumno.nombre)}</p>
      <div class="ex-sin-entregar">Este alumno todavía no ha entregado el examen de ${esc(nombreParcial)}.</div>
      ${pie()}
    </div>`);
    return;
  }

  const reactivos = (intento.ids || [])
    .map(id => (banco.reactivos || []).find(r => r.id === id))
    .filter(Boolean);
  const detalleHTML = reactivos.map((r, i) => detalleReactivoHTML(r, i + 1, intento)).join('');

  const cuerpo = `<div class="hoja">
    ${encabezado(logo, asignatura)}
    <h1>Examen resuelto — ${esc(nombreParcial)}</h1>
    <p class="subtitulo">${esc(alumno.nombre)}</p>
    <div class="datos">
      <div class="dato"><div class="dato-etq">Grupo</div><div class="dato-val">${esc(nombreGrupo)}</div></div>
      <div class="dato"><div class="dato-etq">Calificación</div><div class="dato-val">${Number(intento.calificacion ?? 0).toFixed(1)} / 10</div></div>
      <div class="dato"><div class="dato-etq">Aciertos</div><div class="dato-val">${intento.aciertos ?? 0} / ${intento.total ?? reactivos.length}</div></div>
      <div class="dato"><div class="dato-etq">Emitido</div><div class="dato-val">${hoy()}</div></div>
    </div>
    <h2>Detalle de respuestas</h2>
    ${detalleHTML || '<p class="empty-inline">No se encontraron los reactivos de este intento en el banco actual.</p>'}
    ${FIRMAS}
    ${pie()}
  </div>`;

  abrirVentana(`Examen — ${alumno.nombre} — ${nombreParcial}`, cuerpo);
}

// ---------- 2. ASISTENCIA (por Parcial) ----------
export async function reporteAsistenciaParcial({ nombreGrupo, alumno, asignatura, parcial, r, diasOrdenados }) {
  const logo = await logoComoDataUrl();
  const nombreParcial = NOMBRES_PARCIAL[parcial] || parcial;
  const ETIQ = { presente: 'Presente', justificado: 'Justificado', retardo: 'Retardo', falta: 'Falta' };

  const dias = diasOrdenados || [];
  const conteo = { presente: 0, retardo: 0, justificado: 0, falta: 0 };
  dias.forEach(d => { const e = d.estado || 'presente'; if (conteo[e] !== undefined) conteo[e]++; });
  const resumen = [
    conteo.presente ? `${conteo.presente} asistencia${conteo.presente !== 1 ? 's' : ''}` : null,
    conteo.justificado ? `${conteo.justificado} justificada${conteo.justificado !== 1 ? 's' : ''}` : null,
    conteo.retardo ? `${conteo.retardo} retardo${conteo.retardo !== 1 ? 's' : ''}` : null,
    conteo.falta ? `${conteo.falta} falta${conteo.falta !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ') || 'Sin registros';

  const cuerpo = `<div class="hoja">
    ${encabezado(logo, asignatura)}
    <h1>Asistencia — ${esc(nombreParcial)}</h1>
    <p class="subtitulo">${esc(alumno.nombre)}</p>
    <div class="datos">
      <div class="dato"><div class="dato-etq">Grupo</div><div class="dato-val">${esc(nombreGrupo)}</div></div>
      <div class="dato"><div class="dato-etq">Puntos</div><div class="dato-val">${r.asistencia.pts.toFixed(2)} / ${r.asistencia.tope}</div></div>
      <div class="dato"><div class="dato-etq">Clases registradas</div><div class="dato-val">${r.asistencia.total}</div></div>
      <div class="dato"><div class="dato-etq">Emitido</div><div class="dato-val">${hoy()}</div></div>
    </div>
    <h2>Resumen: ${resumen}</h2>
    <div class="leyenda">
      <span><i class="lg a-presente"></i> Presente</span>
      <span><i class="lg a-justificado"></i> Justificado</span>
      <span><i class="lg a-retardo"></i> Retardo (50%)</span>
      <span><i class="lg a-falta"></i> Falta (0%)</span>
    </div>
    ${dias.length === 0 ? '<p class="empty-inline">Sin días registrados en este parcial.</p>' : `
    <div class="asis-grid">
      ${dias.map(a => {
        const estado = a.estado || 'presente';
        const f = (a.fecha || '').split('-');
        const dia = f.length === 3 ? `${f[2]}/${f[1]}` : (a.fecha || '?');
        return `<div class="asis-dia a-${estado}" title="${esc(a.fecha)} — ${ETIQ[estado] || estado}">${dia}</div>`;
      }).join('')}
    </div>`}
    ${FIRMAS}
    ${pie()}
  </div>`;

  abrirVentana(`Asistencia — ${alumno.nombre} — ${nombreParcial}`, cuerpo);
}

// ---------- 3. TAREAS Y PARTICIPACIÓN (los 3 parciales) ----------
export async function reporteTareasYParticipacionAlumno({ nombreGrupo, alumno, asignatura, resultados }) {
  const logo = await logoComoDataUrl();

  const filaTexto = (nombre, lista, conCalif) => {
    if (!lista || lista.length === 0) return `<p class="empty-inline">Sin registros.</p>`;
    const filas = lista.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
      .map(x => `<li>${esc(x.fecha || 'sin fecha')} — ${esc(x.nombre || '')}${conCalif && x.calificacion !== undefined ? `: <strong>${Number(x.calificacion).toFixed(1)}/10</strong>` : ''}</li>`).join('');
    return `<ul style="margin:6px 0 0; padding-left:18px; font-size:.78rem;">${filas}</ul>`;
  };

  const secciones = ['p1', 'p2', 'final'].map(p => {
    const r = resultados[p];
    const esFinal = p === 'final';
    const tareas = esFinal ? null : r.tareas;
    const participacion = esFinal ? null : r.participacion;
    const combinado = esFinal ? r.tareasParticipacion : null;

    return `<h2>${NOMBRES_PARCIAL[p]}</h2>
      ${esFinal
        ? `<p style="font-size:.8rem; margin:0 0 6px;"><strong>Tareas y Participación combinadas:</strong> ${combinado.pts.toFixed(1)} / ${combinado.tope} pts</p>${filaTexto('', combinado.lista, true)}`
        : `<p style="font-size:.8rem; margin:0 0 4px;"><strong>Tareas:</strong> ${tareas.pts.toFixed(1)} / ${tareas.tope} pts</p>${filaTexto('', tareas.lista, true)}
           <p style="font-size:.8rem; margin:12px 0 4px;"><strong>Participación:</strong> ${participacion.pts.toFixed(1)} / ${participacion.tope} pts (${participacion.cantidad} de ${participacion.meta})</p>${filaTexto('', participacion.lista, false)}`}`;
  }).join('');

  const cuerpo = `<div class="hoja">
    ${encabezado(logo, asignatura)}
    <h1>Tareas y Participación</h1>
    <p class="subtitulo">${esc(alumno.nombre)}</p>
    <div class="datos">
      <div class="dato"><div class="dato-etq">Grupo</div><div class="dato-val">${esc(nombreGrupo)}</div></div>
      <div class="dato"><div class="dato-etq">Parciales</div><div class="dato-val">3</div></div>
      <div class="dato"><div class="dato-etq">&nbsp;</div><div class="dato-val">&nbsp;</div></div>
      <div class="dato"><div class="dato-etq">Emitido</div><div class="dato-val">${hoy()}</div></div>
    </div>
    ${secciones}
    ${FIRMAS}
    ${pie()}
  </div>`;

  abrirVentana(`Tareas y Participación — ${alumno.nombre}`, cuerpo);
}

// ---------- 4. CONCENTRADO (los 3 parciales, resumen general) ----------
export async function reporteConcentradoParcial({ nombreGrupo, alumno, asignatura, resultados, totalCuatrimestre }) {
  const logo = await logoComoDataUrl();

  const filaParcial = (p) => {
    const r = resultados[p];
    if (p === 'final') {
      return `<tr>
        <td class="alumno">${NOMBRES_PARCIAL[p]}</td>
        <td class="num">${r.examen.pts.toFixed(1)}/40</td>
        <td class="num">${r.proyecto.pts.toFixed(1)}/40</td>
        <td class="num">${r.tareasParticipacion.pts.toFixed(1)}/15</td>
        <td class="num">—</td>
        <td class="num">${r.asistencia.pts.toFixed(2)}/5</td>
        <td class="num total-col">${r.total.toFixed(1)}</td>
        <td class="num">${badge(r.total / 10)}</td>
      </tr>`;
    }
    if (p === 'p2') {
      return `<tr>
        <td class="alumno">${NOMBRES_PARCIAL[p]}</td>
        <td class="num">${r.examenEscrito.pts.toFixed(1)}/20 + ${r.practico.pts.toFixed(1)}/20</td>
        <td class="num">—</td>
        <td class="num">${r.tareas.pts.toFixed(1)}/25</td>
        <td class="num">${r.participacion.pts.toFixed(1)}/25</td>
        <td class="num">${r.asistencia.pts.toFixed(2)}/5</td>
        <td class="num total-col">${r.total.toFixed(1)}</td>
        <td class="num">${badge(r.total / 10)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="alumno">${NOMBRES_PARCIAL[p]}</td>
      <td class="num">${r.examen.pts.toFixed(1)}/40</td>
      <td class="num">—</td>
      <td class="num">${r.tareas.pts.toFixed(1)}/25</td>
      <td class="num">${r.participacion.pts.toFixed(1)}/25</td>
      <td class="num">${r.asistencia.pts.toFixed(2)}/5</td>
      <td class="num total-col">${r.total.toFixed(1)}</td>
      <td class="num">${badge(r.total / 10)}</td>
    </tr>`;
  };

  const filasProyecto = Object.keys(NOMBRES_ENTREGA_PROYECTO).map(entrega => {
    const d = resultados.final.proyecto.detalle[entrega];
    return `<tr>
      <td class="alumno">${NOMBRES_ENTREGA_PROYECTO[entrega]}</td>
      <td class="num">${d.calificacion !== null ? Number(d.calificacion).toFixed(1) + '/10' : 'sin capturar'}</td>
      <td class="num total-col">${d.pts.toFixed(1)} / ${d.tope}</td>
    </tr>`;
  }).join('');

  const cuerpo = `<div class="hoja">
    ${encabezado(logo, asignatura)}
    <h1>Concentrado de evaluación</h1>
    <p class="subtitulo">${esc(alumno.nombre)}</p>
    <div class="datos">
      <div class="dato"><div class="dato-etq">Grupo</div><div class="dato-val">${esc(nombreGrupo)}</div></div>
      <div class="dato"><div class="dato-etq">Docente</div><div class="dato-val">${esc(ESCUELA_BASE.docente)}</div></div>
      <div class="dato"><div class="dato-etq">Calificación final</div><div class="dato-val">${(totalCuatrimestre / 10).toFixed(1)} / 10</div></div>
      <div class="dato"><div class="dato-etq">Emitido</div><div class="dato-val">${hoy()}</div></div>
    </div>
    <h2>Concentrado por parcial</h2>
    <table>
      <thead><tr>
        <th>Parcial</th><th class="num">Examen</th><th class="num">Proyecto</th>
        <th class="num">Tareas</th><th class="num">Particip.</th><th class="num">Asist.</th>
        <th class="num">Total /100</th><th class="num">Calif.</th>
      </tr></thead>
      <tbody>
        ${filaParcial('p1')}
        ${filaParcial('p2')}
        ${filaParcial('final')}
        <tr class="fila-total"><td colspan="6">Calificación final del cuatrimestre (P1 25% + P2 25% + Final 50%)</td>
        <td class="num" colspan="2">${(totalCuatrimestre / 10).toFixed(1)} / 10</td></tr>
      </tbody>
    </table>
    <h2>Proyecto "Mi Plato, Mi Historia" — detalle por entrega</h2>
    <table>
      <thead><tr><th>Entrega</th><th class="num">Calificación</th><th class="num">Puntos</th></tr></thead>
      <tbody>${filasProyecto}</tbody>
    </table>
    ${FIRMAS}
    ${pie()}
  </div>`;

  abrirVentana(`Concentrado — ${alumno.nombre}`, cuerpo);
}
