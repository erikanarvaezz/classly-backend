const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

// CREAR una materia (solo profesor)
router.post('/', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    if (!nombre) {
      return res.status(400).json({ error: 'Escribe el nombre de la materia' });
    }
    const profesor_id = req.usuario.id; // sacado del token, no del body (más seguro)

    const [resultado] = await pool.query(
      'INSERT INTO materias (nombre, profesor_id) VALUES (?, ?)',
      [nombre, profesor_id]
    );

    res.status(201).json({ mensaje: 'Materia creada', id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo crear la materia', detalle: error.message });
  }
});

// VER las materias del profesor logueado
router.get('/mis-materias', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const [materias] = await pool.query(
      `SELECT m.*,
        (SELECT COUNT(*) FROM inscripciones i WHERE i.materia_id = m.id_materia) AS inscritos,
        (SELECT AVG(n.valor) FROM notas n WHERE n.materia_id = m.id_materia) AS promedio
       FROM materias m
       WHERE m.profesor_id = ?
       ORDER BY m.nombre`,
      [req.usuario.id]
    );
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener materias', detalle: error.message });
  }
});

module.exports = router;