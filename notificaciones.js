const pool = require('./db');

// Envía notificaciones push con el servicio de Expo (https://exp.host).
// Nunca lanza errores: si algo falla, solo lo anota en la consola para no romper la petición original.
async function enviarPush(usuarioIds, { titulo, cuerpo, datos = {} }) {
  try {
    const ids = [...new Set((usuarioIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return;

    const [filas] = await pool.query('SELECT token FROM push_tokens WHERE usuario_id IN (?)', [ids]);
    const tokens = filas.map((f) => f.token);
    if (!tokens.length) return;

    const mensajes = tokens.map((to) => ({ to, title: titulo, body: cuerpo, data: datos, sound: 'default', channelId: 'default' }));

    for (let i = 0; i < mensajes.length; i += 100) {
      const lote = mensajes.slice(i, i + 100);
      const respuesta = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(lote),
      });
      const json = await respuesta.json().catch(() => ({}));
      const tickets = Array.isArray(json.data) ? json.data : [];

      // Si un celular ya no existe (desinstalaron la app), se borra su token
      for (let j = 0; j < tickets.length; j++) {
        if (tickets[j]?.status === 'error' && tickets[j]?.details?.error === 'DeviceNotRegistered') {
          await pool.query('DELETE FROM push_tokens WHERE token = ?', [lote[j].to]);
        }
      }
    }
  } catch (error) {
    console.log('⚠️  No se pudo enviar la notificación:', error.message);
  }
}

// Evita mandar muchas notificaciones seguidas por lo mismo (ej. el profesor crea 5 preguntas)
const ultimosEnvios = new Map();
function puedeEnviar(clave, minutos = 10) {
  const ahora = Date.now();
  if (ahora - (ultimosEnvios.get(clave) || 0) < minutos * 60 * 1000) return false;
  ultimosEnvios.set(clave, ahora);
  return true;
}

module.exports = { enviarPush, puedeEnviar };
