const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

// REGISTRAR una nota (solo profesor)
router.post('/', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { estudiante_id, materia_id, valor, descripcion, fecha } = req.body;

    const [resultado] = await pool.query(
      'INSERT INTO notas (estudiante_id, materia_id, valor, descripcion, fecha) VALUES (?, ?, ?, ?, ?)',
      [estudiante_id, materia_id, valor, descripcion, fecha]
    );

    res.status(201).json({ mensaje: 'Nota registrada', id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo registrar la nota', detalle: error.message });
  }
});

// VER mis notas (estudiante logueado ve solo las suyas)
router.get('/mis-notas', verificarToken, permitirRoles('estudiante'), async (req, res) => {
  try {
    const [notas] = await pool.query(
      `SELECT notas.*, materias.nombre AS materia
       FROM notas
       JOIN materias ON notas.materia_id = materias.id_materia
       WHERE notas.estudiante_id = ?
       ORDER BY notas.id_notas DESC`,
      [req.usuario.id]
    );
    res.json(notas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notas', detalle: error.message });
  }
});

// VER todas las notas de una materia (solo profesor, y solo si es SU materia)
router.get('/materia/:materia_id', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { materia_id } = req.params;

    // Verificar que la materia sea del profesor logueado
    const [materia] = await pool.query(
      'SELECT * FROM materias WHERE id_materia = ? AND profesor_id = ?',
      [materia_id, req.usuario.id]
    );

    if (materia.length === 0) {
      return res.status(403).json({ error: 'Esta materia no te pertenece' });
    }

    const [notas] = await pool.query(
      `SELECT notas.*, usuarios.nombre AS estudiante
       FROM notas
       JOIN usuarios ON notas.estudiante_id = usuarios.id_usuarios
       WHERE notas.materia_id = ?
       ORDER BY notas.id_notas DESC`,
      [materia_id]
    );

    res.json(notas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notas', detalle: error.message });
  }
});

module.exports = router;
