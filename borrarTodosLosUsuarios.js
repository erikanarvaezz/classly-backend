// Deja la app "como nueva": borra TODAS las cuentas y sus datos
// (notas, inscripciones, materias, preguntas, puntajes del juego y tokens de notificaciones).
// Las tablas se quedan, solo se vacían. NO se puede deshacer.
//
// Base de datos de la NUBE (la que usa el APK):  node borrarTodosLosUsuarios.js --nube
// Base de datos de tu compu:                     node borrarTodosLosUsuarios.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const enNube = process.argv[2] === '--nube';
if (enNube) {
  require('dotenv').config({ path: path.join(__dirname, 'variables-render.txt'), override: true, quiet: true });
  if (!process.env.DB_SSL_CA_FILE || !fs.existsSync(process.env.DB_SSL_CA_FILE)) {
    process.env.DB_SSL_CA_FILE = path.join(__dirname, 'ca.pem');
  }
} else {
  require('dotenv').config({ override: true, quiet: true });
}
const pool = require('./db');

// Del más "hijo" al más "padre"
const TABLAS = ['push_tokens', 'puntajes', 'notas', 'inscripciones', 'preguntas', 'materias', 'usuarios'];

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r.trim()); }));
}

(async () => {
  const conexion = await pool.getConnection();
  try {
    console.log(enNube ? '\n☁️  Base de datos de la NUBE (Aiven)\n' : '\n💻 Base de datos de TU COMPU\n');
    const existentes = [];
    for (const tabla of TABLAS) {
      try {
        const [[{ total }]] = await conexion.query(`SELECT COUNT(*) AS total FROM \`${tabla}\``);
        console.log(`   ${tabla.padEnd(14)} ${total} registros`);
        existentes.push(tabla);
      } catch {
        console.log(`   ${tabla.padEnd(14)} (no existe, se salta)`);
      }
    }

    const respuesta = await preguntar('\n⚠️  Esto borra TODO lo de arriba y no se puede deshacer.\n   Escribe BORRAR para continuar: ');
    if (respuesta !== 'BORRAR') {
      console.log('❎ Cancelado. No se borró nada.');
      return;
    }

    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of existentes) {
      await conexion.query(`DELETE FROM \`${tabla}\``);
      await conexion.query(`ALTER TABLE \`${tabla}\` AUTO_INCREMENT = 1`);
    }
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✅ Listo: no queda nadie registrado.');
    console.log(`   Para volver a tener Dirección, regístrate en la app con ${process.env.ADMIN_EMAIL || 'el correo de ADMIN_EMAIL'}.`);
  } catch (error) {
    console.log('❌ No se pudo borrar:', error.message);
  } finally {
    conexion.release();
    await pool.end();
  }
})();
