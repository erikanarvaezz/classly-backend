const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
require('dotenv').config();

const router = express.Router();

// El correo del administrador se define en el archivo .env (ADMIN_EMAIL)
function esCorreoAdmin(email) {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return admin !== '' && String(email || '').trim().toLowerCase() === admin;
}

// REGISTRO PÚBLICO (crea cuentas de estudiante, sin importar qué rol mande el cliente;
// solo el correo de ADMIN_EMAIL queda como administrador)
router.post('/registro', async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const { contrasena } = req.body;

    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const [existente] = await pool.query('SELECT id_usuarios FROM usuarios WHERE LOWER(TRIM(email)) = ?', [email]);
    if (existente.length > 0) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, contrasena_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, contrasena_hash, esCorreoAdmin(email) ? 'admin' : 'estudiante']
    );

    res.status(201).json({ mensaje: 'Usuario creado', id: resultado.insertId });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo registrar el usuario', detalle: error.message });
  }
});

// CREAR CUENTA DE PROFESOR (solo un profesor ya logueado puede hacerlo)
router.post('/registro-profesor', verificarToken, permitirRoles('profesor'), async (req, res) => {
  try {
    const { nombre, email, contrasena } = req.body;

    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const [existente] = await pool.query('SELECT id_usuarios FROM usuarios WHERE email = ?', [email]);
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
    res.status(500).json({ error: 'No se pudo registrar el profesor', detalle: error.message });
  }
});

// CAMBIAR el personaje (avatar) del usuario logueado
const AVATARES = ['pez', 'tortuga', 'cangrejo', 'medusa', 'mantarraya', 'foca', 'ajolote', 'estrella', 'ballena', 'concha', 'pulpito'];
router.patch('/avatar', verificarToken, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (avatar !== null && !AVATARES.includes(avatar)) {
      return res.status(400).json({ error: 'Avatar no válido' });
    }
    await pool.query('UPDATE usuarios SET avatar = ? WHERE id_usuarios = ?', [avatar, req.usuario.id]);
    res.json({ mensaje: 'Avatar actualizado', avatar });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cambiar el avatar', detalle: error.message });
  }
});

// CAMBIAR mi contraseña (estando logueado)
router.patch('/contrasena', verificarToken, async (req, res) => {
  try {
    const actual = String(req.body.actual || '');
    const nueva = String(req.body.nueva || '');
    if (nueva.length < 6) {
      return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
    }
    const [filas] = await pool.query('SELECT contrasena_hash FROM usuarios WHERE id_usuarios = ?', [req.usuario.id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valida = await bcrypt.compare(actual, filas[0].contrasena_hash);
    if (!valida) return res.status(400).json({ error: 'La contraseña actual no es correcta' });

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuarios = ?', [hash, req.usuario.id]);
    res.json({ mensaje: 'Contraseña cambiada' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo cambiar la contraseña', detalle: error.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const contrasena = String(req.body.contrasena || '');

    // Se compara sin mayúsculas ni espacios sobrantes (el teclado del celular a veces agrega un espacio)
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const usuario = usuarios[0];
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // Si la cuenta ya existía y su correo es el de ADMIN_EMAIL, se convierte en administrador
    if (esCorreoAdmin(usuario.email) && usuario.rol !== 'admin') {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id_usuarios = ?', ['admin', usuario.id_usuarios]);
      usuario.rol = 'admin';
    }

    const token = jwt.sign(
      { id: usuario.id_usuarios, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre, avatar: usuario.avatar || null });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión', detalle: error.message });
  }
});

module.exports = router;