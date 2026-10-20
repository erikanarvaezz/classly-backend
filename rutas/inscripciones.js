const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

// INSCRIBIR un estudiante a una materia (solo profesor)
router.post('/', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { estudiante_id, materia_id } = req.body;

    const [resultado] = await pool.query(
      'INSERT INTO inscripciones (estudiante_id, materia_id) VALUES (?, ?)',
      [estudiante_id, materia_id]
    );

    res.status(201).json({ mensaje: 'Estudiante inscrito', id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo inscribir', detalle: error.message });
  }
});

// VER estudiantes inscritos en una materia (solo profesor)
router.get('/materia/:materia_id', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { materia_id } = req.params;

    const [estudiantes] = await pool.query(
      `SELECT usuarios.id_usuarios, usuarios.nombre, usuarios.email
       FROM inscripciones
       JOIN usuarios ON inscripciones.estudiante_id = usuarios.id_usuarios
       WHERE inscripciones.materia_id = ?`,
      [materia_id]
    );

    res.json(estudiantes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estudiantes', detalle: error.message });
  }
});

module.exports = router;