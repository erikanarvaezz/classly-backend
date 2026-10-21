const express = require('express');
const pool = require('../db');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();
const FORMATO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

// GUARDAR el token del celular del usuario logueado
router.post('/token', verificarToken, async (req, res) => {
  try {
    const token = String(req.body.token || '');
    if (!FORMATO_TOKEN.test(token)) return res.status(400).json({ error: 'Token no válido' });

    await pool.query(
      `INSERT INTO push_tokens (usuario_id, token) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id)`,
      [req.usuario.id, token]
    );
    res.json({ mensaje: 'Token guardado' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar el token', detalle: error.message });
  }
});

// QUITAR el token al cerrar sesión (para no recibir avisos de otra cuenta)
router.delete('/token', verificarToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM push_tokens WHERE token = ? AND usuario_id = ?', [String(req.body.token || ''), req.usuario.id]);
    res.json({ mensaje: 'Token eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo eliminar el token', detalle: error.message });
  }
});

module.exports = router;
