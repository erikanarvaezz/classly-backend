// Conexión con la API de Claude (Anthropic) usando fetch, sin librerías extra.
// Si no hay ANTHROPIC_API_KEY en el .env, la app funciona en MODO DEMO.

const URL_API = 'https://api.anthropic.com/v1/messages';

function iaConfigurada() {
  return (process.env.ANTHROPIC_API_KEY || '').trim() !== '';
}

function modelo() {
  return (process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5').trim();
}

function traducirError(status, mensaje) {
  const m = String(mensaje || '').toLowerCase();
  if (m.includes('credit')) return 'Se acabó el saldo de la IA. Hay que recargar la cuenta de Anthropic.';
  if (status === 401) return 'La clave de la IA no es válida. Revisa ANTHROPIC_API_KEY en el .env.';
  if (status === 404) return 'El modelo de IA configurado no existe. Revisa ANTHROPIC_MODEL en el .env.';
  if (status === 429) return 'Muchas preguntas seguidas. Espera un momento y vuelve a intentar.';
  if (status >= 500) return 'La IA está saturada en este momento. Intenta de nuevo en un rato.';
  return 'La IA no pudo responder.';
}

// Convierte el historial de la app [{de:'yo'|'ia', texto}] al formato de Claude
function prepararHistorial(mensajes, maximo = 12) {
  const limpios = (Array.isArray(mensajes) ? mensajes : [])
    .filter((m) => m && typeof m.texto === 'string' && m.texto.trim() !== '')
    .slice(-maximo)
    .map((m) => ({ role: m.de === 'yo' ? 'user' : 'assistant', content: m.texto.trim().slice(0, 1500) }));

  // Debe empezar con el usuario y alternar roles
  while (limpios.length && limpios[0].role !== 'user') limpios.shift();
  const resultado = [];
  for (const m of limpios) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += `\n\n${m.content}`;
    else resultado.push({ ...m });
  }
  // Y debe terminar con el usuario
  while (resultado.length && resultado[resultado.length - 1].role !== 'user') resultado.pop();
  return resultado;
}

async function preguntarAClaude({ sistema, mensajes, maxTokens = 700 }) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 30000);
  try {
    const respuesta = await fetch(URL_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: modelo(), max_tokens: maxTokens, system: sistema, messages: mensajes }),
      signal: controlador.signal,
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      console.log('Error de la API de Claude:', respuesta.status, datos?.error?.message);
      const error = new Error(traducirError(respuesta.status, datos?.error?.message));
      error.status = respuesta.status;
      throw error;
    }
    return (datos.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La IA tardó demasiado en responder. Intenta otra vez.');
    if (error.status) throw error;
    console.log('No se pudo contactar a la IA:', error.message);
    throw new Error('No se pudo contactar a la IA. Revisa la conexión a internet del servidor.');
  } finally {
    clearTimeout(temporizador);
  }
}

// Límite simple para que nadie gaste todo el saldo: 20 mensajes cada 10 minutos por usuario
const usos = new Map();
function dentroDelLimite(usuarioId, maximo = 20, ventanaMs = 10 * 60 * 1000) {
  const ahora = Date.now();
  const lista = (usos.get(usuarioId) || []).filter((t) => ahora - t < ventanaMs);
  if (lista.length >= maximo) {
    usos.set(usuarioId, lista);
    return false;
  }
  lista.push(ahora);
  usos.set(usuarioId, lista);
  return true;
}

module.exports = { iaConfigurada, preguntarAClaude, prepararHistorial, dentroDelLimite };
