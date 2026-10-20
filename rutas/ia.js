const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { iaConfigurada, preguntarAClaude, prepararHistorial, dentroDelLimite } = require('../ia/claude');

const router = express.Router();

const promedio = (valores) => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0);
const fecha = (f) => new Date(f).toISOString().slice(0, 10);
const ultimoMensaje = (mensajes) =>
  [...(Array.isArray(mensajes) ? mensajes : [])].reverse().find((m) => m && m.de === 'yo')?.texto?.toLowerCase() || '';

function revisarLimite(req, res) {
  if (!iaConfigurada()) return true; // en modo demo no se gasta nada
  if (dentroDelLimite(req.usuario.id)) return true;
  res.status(429).json({ error: 'Has enviado muchos mensajes seguidos. Descansa unos minutos y vuelve.' });
  return false;
}

// Agrupa notas por materia: [{ materia, promedio, notas: [...] }]
function agruparPorMateria(notas) {
  const grupos = new Map();
  for (const n of notas) {
    const g = grupos.get(n.materia) || { materia: n.materia, notas: [] };
    g.notas.push(n);
    grupos.set(n.materia, g);
  }
  return [...grupos.values()].map((g) => ({ ...g, promedio: promedio(g.notas.map((n) => Number(n.valor))) }));
}

// =====================================================================
// TUTOR DEL ESTUDIANTE (conoce sus notas)
// =====================================================================
router.post('/tutor', verificarToken, permitirRoles('estudiante'), async (req, res) => {
  try {
    if (!revisarLimite(req, res)) return;

    const [notas] = await pool.query(
      `SELECT notas.valor, notas.descripcion, notas.fecha, materias.nombre AS materia
       FROM notas JOIN materias ON notas.materia_id = materias.id_materia
       WHERE notas.estudiante_id = ?
       ORDER BY notas.fecha DESC LIMIT 60`,
      [req.usuario.id]
    );
    const materias = agruparPorMateria(notas).sort((a, b) => a.promedio - b.promedio);

    if (!iaConfigurada()) {
      return res.json({ respuesta: respuestaDemoTutor(req.usuario.nombre, materias, ultimoMensaje(req.body.mensajes)), demo: true });
    }

    const contexto = materias.length
      ? materias
          .map(
            (m) =>
              `- ${m.materia}: promedio ${m.promedio.toFixed(1)} (${m.notas
                .map((n) => `${n.descripcion || 'nota'} ${Number(n.valor).toFixed(1)} el ${fecha(n.fecha)}`)
                .join('; ')})`
          )
          .join('\n')
      : '- Todavía no tiene notas registradas.';

    const sistema = `Eres el Tutor Classly, un pulpo amable que ayuda a estudiantes de una escuela de El Salvador a aprender.
Hablas en español sencillo y cercano, con frases cortas. Escala de notas: 0 a 10 (8 o más es buena, 7 a 7.9 necesita mejorar, menos de 7 es baja).

Estudiante: ${req.usuario.nombre}
Sus notas por materia:
${contexto}

Cómo ayudas:
- Usa sus notas para recomendar qué repasar primero y por qué.
- Enseña en vez de solo dar respuestas: explica paso a paso, da un ejemplo y termina con una pregunta corta para que practique.
- Si pide que le hagas la tarea, ayúdale a entenderla guiándolo, sin darle el trabajo resuelto.
- Anima sin exagerar; nunca lo hagas sentir mal por una nota baja.
- Responde en texto plano (sin markdown, sin asteriscos ni #). Si haces una lista, usa "•". Máximo unas 150 palabras.
- Habla solo de estudio y de la escuela. Si menciona que se siente muy mal o que algo grave le pasa, responde con cariño y anímale a hablar con un adulto de confianza o un orientador de la escuela.`;

    const mensajes = prepararHistorial(req.body.mensajes);
    if (!mensajes.length) return res.status(400).json({ error: 'Escribe una pregunta' });

    const respuesta = await preguntarAClaude({ sistema, mensajes });
    res.json({ respuesta, demo: false });
  } catch (error) {
    res.status(error.status === 429 ? 429 : 502).json({ error: error.message || 'La IA no pudo responder' });
  }
});

function respuestaDemoTutor(nombre, materias, pregunta) {
  const aviso = '\n\n(Modo demo: esta respuesta es un ejemplo. Cuando conecten la IA, te responderé de verdad.)';
  if (!materias.length) {
    return `¡Hola, ${nombre}! Todavía no veo notas tuyas. Cuando tu profesor suba la primera, te diré qué conviene repasar.${aviso}`;
  }
  const baja = materias[0];
  const alta = materias[materias.length - 1];
  if (pregunta.includes('plan') || pregunta.includes('semana')) {
    return `Aquí va un plan para esta semana, ${nombre}:\n• Lunes y miércoles: 30 min de ${baja.materia} (es tu promedio más bajo, ${baja.promedio.toFixed(1)}).\n• Martes: repasa con las tarjetas del mini juego.\n• Jueves: quiz contra reloj de ${baja.materia}.\n• Viernes: un repaso ligero de ${alta.materia} para mantener tu ${alta.promedio.toFixed(1)}.${aviso}`;
  }
  if (pregunta.includes('repasar') || pregunta.includes('materia') || pregunta.includes('baja') || pregunta.includes('nota')) {
    return `Te conviene empezar por ${baja.materia}: tu promedio ahí es ${baja.promedio.toFixed(1)}. Su nota más reciente fue "${baja.notas[0].descripcion || 'nota'}" con ${Number(baja.notas[0].valor).toFixed(1)}.\n• Repasa ese tema con las tarjetas del mini juego.\n• Luego haz el quiz para medir cuánto mejoraste.\n¿Qué parte de ${baja.materia} se te hace más difícil?${aviso}`;
  }
  return `¡Buena pregunta, ${nombre}! En modo demo todavía no puedo explicarte temas nuevos, pero sí veo tus notas: tu mejor materia es ${alta.materia} (${alta.promedio.toFixed(1)}) y la que más te conviene repasar es ${baja.materia} (${baja.promedio.toFixed(1)}).${aviso}`;
}

// =====================================================================
// ASISTENTE DEL PROFESOR (chat libre)
// =====================================================================
async function materiaDelProfesor(materiaId, profesorId) {
  const [filas] = await pool.query('SELECT id_materia, nombre FROM materias WHERE id_materia = ? AND profesor_id = ?', [
    materiaId,
    profesorId,
  ]);
  return filas[0];
}

router.post('/profesor/chat', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    if (!revisarLimite(req, res)) return;
    const { materia_id } = req.body;

    let contexto = '';
    let resumenDemo = '';
    if (materia_id) {
      const materia = await materiaDelProfesor(materia_id, req.usuario.id);
      if (!materia) return res.status(403).json({ error: 'Esta materia no es tuya' });

      const [notas] = await pool.query(
        `SELECT usuarios.nombre AS estudiante, notas.valor, notas.descripcion, notas.fecha
         FROM notas JOIN usuarios ON notas.estudiante_id = usuarios.id_usuarios
         WHERE notas.materia_id = ? ORDER BY notas.fecha DESC LIMIT 150`,
        [materia_id]
      );
      const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM inscripciones WHERE materia_id = ?', [materia_id]);

      const porEstudiante = new Map();
      for (const n of notas) {
        const lista = porEstudiante.get(n.estudiante) || [];
        lista.push(n);
        porEstudiante.set(n.estudiante, lista);
      }
      const resumen = [...porEstudiante.entries()]
        .map(([est, lista]) => ({ est, prom: promedio(lista.map((n) => Number(n.valor))), lista }))
        .sort((a, b) => a.prom - b.prom);

      contexto = `Materia: ${materia.nombre} (${total} estudiantes inscritos)
Notas por estudiante (de menor a mayor promedio):
${
  resumen.length
    ? resumen
        .map((r) => `- ${r.est}: promedio ${r.prom.toFixed(1)} (${r.lista.map((n) => `${n.descripcion || 'nota'} ${Number(n.valor).toFixed(1)}`).join('; ')})`)
        .join('\n')
    : '- Aún no hay notas registradas.'
}`;
      resumenDemo = resumen.length
        ? `En ${materia.nombre} hay ${resumen.length} estudiantes con notas. ${resumen[0].est} tiene el promedio más bajo (${resumen[0].prom.toFixed(1)}) y ${resumen[resumen.length - 1].est} el más alto (${resumen[resumen.length - 1].prom.toFixed(1)}).`
        : `En ${materia.nombre} todavía no hay notas registradas.`;
    } else {
      const [materias] = await pool.query(
        `SELECT materias.nombre, COUNT(notas.id_notas) AS cantidad, AVG(notas.valor) AS prom
         FROM materias LEFT JOIN notas ON notas.materia_id = materias.id_materia
         WHERE materias.profesor_id = ? GROUP BY materias.id_materia`,
        [req.usuario.id]
      );
      contexto = `Materias del profesor:\n${materias
        .map((m) => `- ${m.nombre}: ${m.cantidad} notas, promedio ${m.prom ? Number(m.prom).toFixed(1) : 'sin notas'}`)
        .join('\n') || '- Ninguna materia todavía.'}`;
      resumenDemo = `Tienes ${materias.length} ${materias.length === 1 ? 'materia' : 'materias'}.`;
    }

    if (!iaConfigurada()) {
      return res.json({
        respuesta: `${resumenDemo}\n\nEn modo demo no puedo responder preguntas libres todavía. Cuando conecten la IA podré ayudarte a planificar clases, explicar temas de otra forma, sugerir actividades y analizar a tu grupo.\n\n(Modo demo)`,
        demo: true,
      });
    }

    const sistema = `Eres el asistente de IA de Classly para profesores de una escuela de El Salvador. Respondes en español, de forma clara, práctica y breve.
Escala de notas: 0 a 10 (8 o más buena, 7 a 7.9 necesita mejorar, menos de 7 baja).

Profesor: ${req.usuario.nombre}
${contexto}

Puedes ayudar a: analizar el rendimiento del grupo, identificar estudiantes que necesitan apoyo, planificar clases y actividades, explicar temas de otra manera, redactar mensajes a padres y crear ejercicios.
Usa los datos de arriba cuando sean relevantes y no inventes notas que no aparecen. Trata la información de los estudiantes con respeto.
Responde en texto plano (sin markdown, sin asteriscos ni #). Para listas usa "•". Máximo unas 200 palabras salvo que pida algo más largo.`;

    const mensajes = prepararHistorial(req.body.mensajes);
    if (!mensajes.length) return res.status(400).json({ error: 'Escribe una pregunta' });

    const respuesta = await preguntarAClaude({ sistema, mensajes, maxTokens: 900 });
    res.json({ respuesta, demo: false });
  } catch (error) {
    res.status(error.status === 429 ? 429 : 502).json({ error: error.message || 'La IA no pudo responder' });
  }
});

// =====================================================================
// GENERAR PREGUNTAS PARA EL MINI JUEGO (el profesor decide cuáles guardar)
// =====================================================================
router.post('/profesor/preguntas', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    if (!revisarLimite(req, res)) return;
    const { materia_id } = req.body;
    const tema = String(req.body.tema || '').trim().slice(0, 200);
    const cantidad = Math.min(8, Math.max(1, Number(req.body.cantidad) || 5));

    if (!tema) return res.status(400).json({ error: 'Escribe el tema' });
    const materia = await materiaDelProfesor(materia_id, req.usuario.id);
    if (!materia) return res.status(403).json({ error: 'Esta materia no es tuya' });

    if (!iaConfigurada()) {
      const ejemplo = Array.from({ length: cantidad }, (_, i) => ({
        pregunta: `(Ejemplo ${i + 1}) Pregunta sobre ${tema}`,
        respuesta_correcta: 'Respuesta correcta',
        incorrecta1: 'Opción incorrecta A',
        incorrecta2: 'Opción incorrecta B',
        incorrecta3: 'Opción incorrecta C',
        explicacion: 'Modo demo: cuando conecten la IA, aquí vendrán preguntas reales sobre el tema.',
      }));
      return res.json({ preguntas: ejemplo, demo: true });
    }

    const sistema = `Eres un profesor experto que crea preguntas de opción múltiple para estudiantes de una escuela de El Salvador.
Escribe en español, con lenguaje claro para el nivel escolar. Cada pregunta tiene UNA respuesta correcta y TRES incorrectas creíbles (errores típicos de estudiantes), todas distintas y de longitud parecida.
Límites: pregunta máximo 250 caracteres; cada opción máximo 120; explicación máximo 250.
Responde ÚNICAMENTE con un arreglo JSON válido, sin texto antes ni después, con este formato:
[{"pregunta":"...","respuesta_correcta":"...","incorrecta1":"...","incorrecta2":"...","incorrecta3":"...","explicacion":"..."}]`;

    const texto = await preguntarAClaude({
      sistema,
      mensajes: [{ role: 'user', content: `Materia: ${materia.nombre}\nTema: ${tema}\nCrea ${cantidad} preguntas.` }],
      maxTokens: 2000,
    });

    const inicio = texto.indexOf('[');
    const fin = texto.lastIndexOf(']');
    let lista = [];
    try {
      lista = JSON.parse(texto.slice(inicio, fin + 1));
    } catch {
      return res.status(502).json({ error: 'La IA respondió en un formato raro. Intenta de nuevo.' });
    }

    const campos = ['pregunta', 'respuesta_correcta', 'incorrecta1', 'incorrecta2', 'incorrecta3'];
    const preguntas = (Array.isArray(lista) ? lista : [])
      .filter((p) => p && campos.every((c) => typeof p[c] === 'string' && p[c].trim() !== ''))
      .slice(0, cantidad)
      .map((p) => ({
        pregunta: p.pregunta.trim().slice(0, 300),
        respuesta_correcta: p.respuesta_correcta.trim().slice(0, 150),
        incorrecta1: p.incorrecta1.trim().slice(0, 150),
        incorrecta2: p.incorrecta2.trim().slice(0, 150),
        incorrecta3: p.incorrecta3.trim().slice(0, 150),
        explicacion: typeof p.explicacion === 'string' ? p.explicacion.trim().slice(0, 300) : '',
      }));

    if (!preguntas.length) return res.status(502).json({ error: 'La IA no generó preguntas válidas. Intenta de nuevo.' });
    res.json({ preguntas, demo: false });
  } catch (error) {
    res.status(error.status === 429 ? 429 : 502).json({ error: error.message || 'La IA no pudo responder' });
  }
});

// Para que la app sepa si la IA está en modo demo
router.get('/estado', verificarToken, (req, res) => {
  res.json({ demo: !iaConfigurada() });
});

module.exports = router;
