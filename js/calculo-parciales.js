// calculo-parciales.js — Fórmula de calificación para materias con esquema
// de PARCIALES, separada por completo de calculo.js (que es solo para Bases
// Culinarias, esquema de Bloques). Mismo criterio que usa cada docente en su
// propio panel admin.js.
//
// Hay DOS variantes del esquema de parciales, según la materia:
//
//   'parciales' (Origen de las Cocinas)
//     Parcial 1: Examen 40 + Tareas 25 + Participación 25 + Asistencia 5
//                + Uniformes 5
//     Parcial 2: Examen ESCRITO 20 + Examen PRÁCTICO 20 + Tareas 25
//                + Participación 25 + Asistencia 5 + Uniformes 5
//
//   'parciales-simple' (Expresión Oral y Escrita)
//     Parcial 1 y Parcial 2 son IGUALES: Examen 40 + Tareas 25
//                + Participación 25 + Asistencia 5 + Uniformes 5
//     No hay examen práctico: esa materia no lleva prácticas de cocina.
//
// El Examen Final es idéntico en ambas variantes:
//   Examen 40 + Proyecto 40 (entregas de 15 + 15 + 10) + Tareas y
//   Participación 15 + Asistencia 5
//   Cuatrimestre: Parcial 1 (25%) + Parcial 2 (25%) + Final (50%)

export const TOPES = {
  p1:    { examen: 40, tareas: 25, participacion: 25, asistencia: 5, uniformes: 5 },
  p2:    { examenEscrito: 20, practico: 20, tareas: 25, participacion: 25, asistencia: 5, uniformes: 5 },
  final: { examen: 40, proyecto: 40, tareasParticipacion: 15, asistencia: 5 },
};

// Parcial 2 de la variante 'parciales-simple': idéntico al Parcial 1.
export const TOPES_P2_SIMPLE = { examen: 40, tareas: 25, participacion: 25, asistencia: 5, uniformes: 5 };

export const TOPES_PROYECTO = { entrega1: 15, entrega2: 15, entregaFinal: 10 };

export const NOMBRES_ENTREGA_PROYECTO = {
  entrega1: 'Entrega 1 (Parcial 1)',
  entrega2: 'Entrega 2 (Parcial 2)',
  entregaFinal: 'Entrega final (exposición individual)',
};

export const META_PARTICIPACION = { p1: 6, p2: 6 };

export const PESO_CUATRIMESTRE = { p1: 0.25, p2: 0.25, final: 0.50 };

export const NOMBRES_PARCIAL = { p1: 'Parcial 1', p2: 'Parcial 2', final: 'Examen Final' };

const PESO_ASISTENCIA = { presente: 1, justificado: 1, retardo: 0.5, falta: 0 };

function promedioCalificaciones(lista) {
  if (!lista || lista.length === 0) return null;
  const suma = lista.reduce((s, x) => s + (Number(x.calificacion) || 0), 0);
  return suma / lista.length;
}

function calcularAsistencia(registros, tope) {
  if (!registros || registros.length === 0) return { pts: 0, tope, presentes: 0, total: 0 };
  const total = registros.length;
  const suma = registros.reduce((s, r) => s + (PESO_ASISTENCIA[r.estado] ?? 0), 0);
  return { pts: (suma / total) * tope, tope, presentes: suma, total };
}

function calcularUniformes(datoUniforme, tope) {
  const faltas = datoUniforme ? Number(datoUniforme.faltas) || 0 : 0;
  if (faltas >= 2) return { pts: 0, tope, faltas };
  if (faltas === 1) return { pts: tope / 2, tope, faltas };
  return { pts: tope, tope, faltas };
}

function calcularRubroPromedio(lista, tope) {
  const prom = promedioCalificaciones(lista);
  const pts = prom === null ? 0 : (prom / 10) * tope;
  return { pts, tope, lista: lista || [], promedio: prom };
}

function calcularParticipacionConteo(lista, meta, tope) {
  const cantidad = (lista || []).length;
  const efectiva = Math.min(cantidad, meta);
  const pts = meta > 0 ? (efectiva / meta) * tope : 0;
  return { pts, tope, cantidad, meta, lista: lista || [] };
}

function calcularExamen(dato, tope) {
  const calificacion = dato && dato.calificacion !== undefined && dato.calificacion !== null
    ? Number(dato.calificacion) : null;
  const pts = calificacion === null ? 0 : (calificacion / 10) * tope;
  return { pts, tope, calificacion };
}

function calcularProyecto(datosProyecto) {
  const detalle = {};
  let pts = 0;
  Object.entries(TOPES_PROYECTO).forEach(([entrega, tope]) => {
    const dato = (datosProyecto || {})[entrega];
    const r = calcularExamen(dato, tope);
    detalle[entrega] = r;
    pts += r.pts;
  });
  return { pts, tope: 40, detalle };
}

// datos = { tareas, participaciones, asistencias, uniformes, examenes, practico, proyecto }
// esquema = 'parciales' (por defecto) o 'parciales-simple'
export function calcularParcial(parcial, datos, esquema = 'parciales') {
  const tareasDelParcial = (datos.tareas || []).filter(t => t.parcial === parcial);
  const participacionDelParcial = (datos.participaciones || []).filter(p => p.parcial === parcial);
  const asistenciaDelParcial = (datos.asistencias || []).filter(a => a.parcial === parcial);

  if (parcial === 'final') {
    const tope = TOPES.final;
    const combinado = [...tareasDelParcial, ...participacionDelParcial];
    const tareasParticipacion = calcularRubroPromedio(combinado, tope.tareasParticipacion);
    const examen = calcularExamen((datos.examenes || {}).final, tope.examen);
    const asistencia = calcularAsistencia(asistenciaDelParcial, tope.asistencia);
    const proyecto = calcularProyecto(datos.proyecto);
    const total = tareasParticipacion.pts + examen.pts + asistencia.pts + proyecto.pts;
    return { parcial, total, examen, tareasParticipacion, asistencia, proyecto };
  }

  // En 'parciales-simple' el Parcial 2 usa los mismos topes que el Parcial 1.
  const esSimple = esquema === 'parciales-simple';
  const tope = (parcial === 'p2' && esSimple) ? TOPES_P2_SIMPLE : TOPES[parcial];

  const tareas = calcularRubroPromedio(tareasDelParcial, tope.tareas);
  const participacion = calcularParticipacionConteo(participacionDelParcial, META_PARTICIPACION[parcial], tope.participacion);
  const asistencia = calcularAsistencia(asistenciaDelParcial, tope.asistencia);
  const uniformes = calcularUniformes((datos.uniformes || {})[parcial], tope.uniformes);

  // Parcial 2 con examen dividido (escrito + práctico): solo en 'parciales'.
  if (parcial === 'p2' && !esSimple) {
    const examenEscrito = calcularExamen((datos.examenes || {}).p2, tope.examenEscrito);
    const practico = calcularExamen((datos.practico || {}).p2, tope.practico);
    const total = tareas.pts + participacion.pts + asistencia.pts + uniformes.pts + examenEscrito.pts + practico.pts;
    return { parcial, total, examenEscrito, practico, tareas, participacion, asistencia, uniformes };
  }

  // p1 — y también p2 cuando el esquema es 'parciales-simple'
  const examen = calcularExamen((datos.examenes || {})[parcial], tope.examen);
  const total = tareas.pts + participacion.pts + asistencia.pts + uniformes.pts + examen.pts;
  return { parcial, total, examen, tareas, participacion, asistencia, uniformes };
}

export function calcularCuatrimestre(resultadosPorParcial) {
  return ['p1', 'p2', 'final'].reduce(
    (s, p) => s + (resultadosPorParcial[p]?.total || 0) * PESO_CUATRIMESTRE[p],
    0
  );
}
