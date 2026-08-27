// firebase-config.js — Coordinación Académica
//
// Esta app NO tiene su propio proyecto de Firebase: se conecta al mismo
// proyecto de "bases-culinarias", porque Coordinación solo necesita LEER
// los datos que el docente ya captura ahí (no escribe nada). Cuando se
// agreguen más materias (Expresión Oral y Escrita, la nueva de Historia/
// Cultura de las Cocinas), se les agrega su propio bloque de configuración
// aquí abajo y aparecerán como pestañas/materias adicionales en la app.
//
// El usuario de Coordinación es un usuario DISTINTO al del docente, dado de
// alta en Firebase Authentication de este mismo proyecto — así cada quien
// entra con su propio correo y contraseña, aunque lean la misma base.
//
// "sitioUrl" es la URL en vivo del Aula Virtual de esa materia — se usa
// para descargar el banco de reactivos del examen (data/examen_bloqueN.json),
// que vive en ESE repo, no en el de Coordinación.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- Materias disponibles ----------
// Cada materia es un proyecto de Firebase propio. Por ahora solo existe
// Bases Culinarias; las demás se agregan aquí cuando estén listas.
export const MATERIAS = [
  {
    id: 'bases-culinarias',
    nombre: 'Bases Culinarias',
    sitioUrl: 'https://jesusrodriguezgarcia749-cloud.github.io/bases-culinarias/',
    firebaseConfig: {
      apiKey: "AIzaSyCrn6_dvsj1qPvTYx05ztaW3R4p_7bGQQ0",
      authDomain: "bases-culinarias.firebaseapp.com",
      projectId: "bases-culinarias",
      storageBucket: "bases-culinarias.firebasestorage.app",
      messagingSenderId: "810616202608",
      appId: "1:810616202608:web:5a47712549207a9d0fdbb5"
    },
  },
  // Próximamente:
  // {
  //   id: 'expresion-oral-escrita',
  //   nombre: 'Expresión Oral y Escrita',
  //   sitioUrl: 'https://jesusrodriguezgarcia749-cloud.github.io/expresion-oral-escrita/',
  //   firebaseConfig: { ... },
  // },
];

// El usuario de Coordinación vive en el proyecto de Firebase de esta
// materia — el login SIEMPRE se hace contra ella, sin importar qué materia
// se esté consultando en un momento dado.
export const MATERIA_LOGIN = 'bases-culinarias';

// Inicializa Firebase para CADA materia y guarda su app/auth/db por id, para
// poder cambiar de materia sin perder la conexión a las demás.
const instancias = {};

function instanciaDe(materiaId) {
  if (instancias[materiaId]) return instancias[materiaId];

  const materia = MATERIAS.find(m => m.id === materiaId);
  if (!materia) throw new Error(`Materia desconocida: ${materiaId}`);

  const app = initializeApp(materia.firebaseConfig, materiaId);
  const auth = getAuth(app);
  const db = getFirestore(app);

  instancias[materiaId] = { app, auth, db };
  return instancias[materiaId];
}

export function authDe(materiaId) {
  return instanciaDe(materiaId).auth;
}

export function dbDe(materiaId) {
  return instanciaDe(materiaId).db;
}

export function sitioDe(materiaId) {
  const materia = MATERIAS.find(m => m.id === materiaId);
  return materia ? materia.sitioUrl : '';
}
