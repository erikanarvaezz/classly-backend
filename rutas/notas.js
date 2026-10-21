const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { enviarPush } = require('../notificaciones');

const router = express.Router();

// Revisa que la nota tenga un valor válido (0 a 10)
function valorValido(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 10;
}

// REGISTRAR una nota (solo profesor, solo en SU materia y a estudiantes inscritos)
router.post('/', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { estudiante_id, materia_id, valor, descripcion, fecha } = req.body;
    if (!valorValido(valor)) return res.status(400).json({ error: 'La nota debe estar entre 0 y 10' });

    const [materia] = await pool.query('SELECT nombre FROM materias WHERE id_materia = ? AND profesor_id = ?', [
      materia_id,
      req.usuario.id,
    ]);
    if (materia.length === 0) return res.status(403).json({ error: 'Esta materia no te pertenece' });

    const [inscrito] = await pool.query('SELECT 1 FROM inscripciones WHERE materia_id = ? AND estudiante_id = ?', [
      materia_id,
      estudiante_id,
    ]);
    if (inscrito.length === 0) return res.status(400).json({ error: 'Ese estudiante no está inscrito en esta materia' });

    const [resultado] = await pool.query(
      'INSERT INTO notas (estudiante_id, materia_id, valor, descripcion, fecha) VALUES (?, ?, ?, ?, ?)',
      [estudiante_id, materia_id, valor, descripcion, fecha]
    );

    res.status(201).json({ mensaje: 'Nota registrada', id: resultado.insertId });

    // Aviso al estudiante (no hace esperar al profesor)
    enviarPush([estudiante_id], {
      titulo: `Nueva nota en ${materia[0].nombre}`,
      cuerpo: `${descripcion ? `${descripcion}: ` : ''}${Number(valor).toFixed(1)}`,
      datos: { ruta: '/estudiante' },
    });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo registrar la nota', detalle: error.message });
  }
});

// Busca una nota y revisa que sea de una materia del profesor logueado
async function notaDelProfesor(id_nota, profesor_id) {
  const [filas] = await pool.query(
    `SELECT notas.*, materias.nombre AS materia FROM notas
     JOIN materias ON notas.materia_id = materias.id_materia
     WHERE notas.id_notas = ? AND materias.profesor_id = ?`,
    [id_nota, profesor_id]
  );
  return filas[0];
}

// EDITAR una nota (valor y descripción)
router.put('/:id', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { valor, descripcion } = req.body;
    if (!valorValido(valor)) return res.status(400).json({ error: 'La nota debe estar entre 0 y 10' });

    const nota = await notaDelProfesor(req.params.id, req.usuario.id);
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' });

    await pool.query('UPDATE notas SET valor = ?, descripcion = ? WHERE id_notas = ?', [valor, descripcion ?? nota.descripcion, req.params.id]);
    res.json({ mensaje: 'Nota actualizada' });

    if (Number(valor) !== Number(nota.valor)) {
      enviarPush([nota.estudiante_id], {
        titulo: `Se corrigió una nota en ${nota.materia}`,
        cuerpo: `${descripcion || nota.descripcion || 'Nota'}: ahora es ${Number(valor).toFixed(1)}`,
        datos: { ruta: '/estudiante' },
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'No se pudo editar la nota', detalle: error.message });
  }
});

// BORRAR una nota
router.delete('/:id', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const nota = await notaDelProfesor(req.params.id, req.usuario.id);
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' });

    await pool.query('DELETE FROM notas WHERE id_notas = ?', [req.params.id]);
    res.json({ mensaje: 'Nota eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo borrar la nota', detalle: error.message });
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
      `SELECT notas.*, usuarios.nombre AS estudiante, usuarios.avatar
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
