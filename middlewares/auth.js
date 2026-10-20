const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verifica que el usuario tenga un token válido (está logueado)
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'No se envió token de acceso' });
  }

  const token = authHeader.split(' ')[1]; // formato: "Bearer eyJhbG..."

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = datos; // { id, rol, nombre }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };