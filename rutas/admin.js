const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { enviarPush } = require('../notificaciones');

const router = express.Router();

// Todas las rutas de este archivo son solo para el administrador
router.use(verificarToken, permitirRoles('admin'));

// VER todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id_usuarios, nombre, email, rol FROM usuarios ORDER BY nombre'
    );
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios', detalle: error.message });
  }
});

// CREAR una cuenta de profesor
router.post('/profesores', async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const { contrasena } = req.body;
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    if (String(contrasena).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const [existente] = await pool.query('SELECT id_usuarios FROM usuarios WHERE LOWER(TRIM(email)) = ?', [email]);
    if (existente.length > 0) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 10);
    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, contrasena_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, contrasena_hash, 'profesor']
    );
    res.status(201).json({ mensaje: 'Profesor creado', id: resultado.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    res.status(500).json({ error: 'No se pudo crear el profesor', detalle: error.message });
  }
});

// CAMBIAR el rol de una cuenta (solo entre estudiante y profesor)
router.patch('/usuarios/:id/rol', async (req, res) => {
  try {
    const { rol } = req.body;
    if (!['estudiante', 'profesor'].includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    if (Number(req.params.id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }

    const [resultado] = await pool.query(
      "UPDATE usuarios SET rol = ? WHERE id_usuarios = ? AND rol <> 'admin'",
      [rol, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Rol actualizado' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cambiar el rol', detalle: error.message });
  }
});

// RESTABLECER la contraseña de una cuenta (Dirección le da una temporal)
router.patch('/usuarios/:id/contrasena', async (req, res) => {
  try {
    const contrasena = String(req.body.contrasena || '');
    if (contrasena.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const [resultado] = await pool.query('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuarios = ?', [hash, req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Contraseña restablecida' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo restablecer la contraseña', detalle: error.message });
  }
});

// VER todas las materias con su profesor y cuántos inscritos tienen
router.get('/materias', async (req, res) => {
  try {
    const [materias] = await pool.query(
      `SELECT materias.id_materia, materias.nombre, usuarios.nombre AS profesor,
              (SELECT COUNT(*) FROM inscripciones WHERE inscripciones.materia_id = materias.id_materia) AS inscritos
       FROM materias
       LEFT JOIN usuarios ON materias.profesor_id = usuarios.id_usuarios
       ORDER BY materias.nombre`
    );
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener materias', detalle: error.message });
  }
});

// VER qué estudiantes están inscritos en una materia (solo sus ids)
router.get('/materias/:id/inscritos', async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT estudiante_id FROM inscripciones WHERE materia_id = ?',
      [req.params.id]
    );
    res.json(filas.map((f) => f.estudiante_id));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener inscritos', detalle: error.message });
  }
});

// INSCRIBIR un estudiante en una materia
router.post('/inscripciones', async (req, res) => {
  try {
    const { estudiante_id, materia_id } = req.body;

    const [estudiante] = await pool.query(
      "SELECT id_usuarios FROM usuarios WHERE id_usuarios = ? AND rol = 'estudiante'",
      [estudiante_id]
    );
    if (estudiante.length === 0) {
      return res.status(400).json({ error: 'Solo se pueden inscribir estudiantes' });
    }

    const [existente] = await pool.query(
      'SELECT 1 FROM inscripciones WHERE estudiante_id = ? AND materia_id = ?',
      [estudiante_id, materia_id]
    );
    if (existente.length > 0) {
      return res.json({ mensaje: 'Ya estaba inscrito' });
    }

    await pool.query('INSERT INTO inscripciones (estudiante_id, materia_id) VALUES (?, ?)', [estudiante_id, materia_id]);
    res.status(201).json({ mensaje: 'Estudiante inscrito' });

    const [[materia]] = await pool.query('SELECT nombre FROM materias WHERE id_materia = ?', [materia_id]);
    enviarPush([estudiante_id], {
      titulo: '¡Tienes una materia nueva!',
      cuerpo: `Te inscribieron en ${materia?.nombre || 'una materia'}. Ya puedes jugar y ver tus notas.`,
      datos: { ruta: '/estudiante' },
    });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo inscribir', detalle: error.message });
  }
});

// QUITAR a un estudiante de una materia (sus notas no se borran)
router.delete('/inscripciones/:materia_id/:estudiante_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inscripciones WHERE materia_id = ? AND estudiante_id = ?', [
      req.params.materia_id,
      req.params.estudiante_id,
    ]);
    res.json({ mensaje: 'Inscripción eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo quitar la inscripción', detalle: error.message });
  }
});

module.exports = router;
