const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

// ¿La materia es del profesor logueado?
async function esMateriaDelProfesor(materia_id, profesor_id) {
  const [filas] = await pool.query(
    'SELECT id_materia FROM materias WHERE id_materia = ? AND profesor_id = ?',
    [materia_id, profesor_id]
  );
  return filas.length > 0;
}

// ¿El estudiante está inscrito en la materia?
async function estaInscrito(materia_id, estudiante_id) {
  const [filas] = await pool.query(
    'SELECT 1 FROM inscripciones WHERE materia_id = ? AND estudiante_id = ?',
    [materia_id, estudiante_id]
  );
  return filas.length > 0;
}

// CREAR una pregunta (solo profesor, y solo en SU materia)
router.post('/', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { materia_id, pregunta, respuesta_correcta, incorrecta1, incorrecta2, incorrecta3, explicacion } = req.body;

    if (!materia_id || !pregunta || !respuesta_correcta || !incorrecta1 || !incorrecta2 || !incorrecta3) {
      return res.status(400).json({ error: 'Faltan datos: pregunta, respuesta correcta y 3 incorrectas' });
    }
    if (!(await esMateriaDelProfesor(materia_id, req.usuario.id))) {
      return res.status(403).json({ error: 'Esta materia no es tuya' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO preguntas (materia_id, pregunta, respuesta_correcta, incorrecta1, incorrecta2, incorrecta3, explicacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [materia_id, pregunta, respuesta_correcta, incorrecta1, incorrecta2, incorrecta3, explicacion || null]
    );

    res.status(201).json({ mensaje: 'Pregunta creada', id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo crear la pregunta', detalle: error.message });
  }
});

// VER las preguntas de una materia
// - profesor: solo si es SU materia
// - estudiante: solo si está inscrito
router.get('/materia/:materia_id', verificarToken, permitirRoles('profesor', 'estudiante'), async (req, res) => {
  try {
    const { materia_id } = req.params;
    const permitido =
      req.usuario.rol === 'profesor'
        ? await esMateriaDelProfesor(materia_id, req.usuario.id)
        : await estaInscrito(materia_id, req.usuario.id);

    if (!permitido) {
      return res.status(403).json({ error: 'No tienes acceso a esta materia' });
    }

    const [preguntas] = await pool.query(
      'SELECT * FROM preguntas WHERE materia_id = ? ORDER BY id_pregunta DESC',
      [materia_id]
    );
    res.json(preguntas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener preguntas', detalle: error.message });
  }
});

// BORRAR una pregunta (solo profesor dueño de la materia)
router.delete('/:id', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const [resultado] = await pool.query(
      `DELETE preguntas FROM preguntas
       JOIN materias ON preguntas.materia_id = materias.id_materia
       WHERE preguntas.id_pregunta = ? AND materias.profesor_id = ?`,
      [req.params.id, req.usuario.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }
    res.json({ mensaje: 'Pregunta eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo eliminar', detalle: error.message });
  }
});

module.exports = router;
