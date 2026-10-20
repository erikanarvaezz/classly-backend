// Prueba rápida de la IA: en la carpeta backend ejecuta  node probarIA.js
const deWindows = process.env.ANTHROPIC_API_KEY;
require('dotenv').config({ override: true, quiet: true });
const { iaConfigurada, preguntarAClaude } = require('./ia/claude');

if (deWindows) {
  console.log(
    deWindows === process.env.ANTHROPIC_API_KEY
      ? 'ℹ️  Windows también tiene ANTHROPIC_API_KEY guardada (es la misma del .env).'
      : '⚠️  Windows tenía OTRA ANTHROPIC_API_KEY guardada. Ahora se usa la del .env.'
  );
}

if (!iaConfigurada()) {
  console.log('❌ Falta ANTHROPIC_API_KEY en el archivo .env');
  process.exit(1);
}

const clave = process.env.ANTHROPIC_API_KEY.trim();
console.log(`Clave del .env: empieza con "${clave.slice(0, 11)}…", ${clave.length} caracteres`);

preguntarAClaude({
  sistema: 'Responde en una sola frase corta en español.',
  mensajes: [{ role: 'user', content: 'Saluda a los estudiantes de Classly' }],
  maxTokens: 80,
})
  .then((texto) => console.log('✅ La IA funciona. Respuesta:', texto))
  .catch((error) => console.log('❌', error.message));
