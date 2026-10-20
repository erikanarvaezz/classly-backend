// Cambia la contraseña de una cuenta.
// Uso (en la carpeta backend):  node cambiarContrasena.js correo@ejemplo.com NuevaContrasena
require('dotenv').config({ override: true, quiet: true });
const bcrypt = require('bcrypt');
const pool = require('./db');

(async () => {
  const [email, nueva] = process.argv.slice(2);
  if (!email || !nueva) {
    console.log('Uso: node cambiarContrasena.js correo@ejemplo.com NuevaContrasena');
    process.exit(1);
  }
  if (nueva.length < 6) {
    console.log('❌ La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }
  try {
    const [usuarios] = await pool.query('SELECT id_usuarios, nombre, rol, email FROM usuarios WHERE LOWER(TRIM(email)) = ?', [email.trim().toLowerCase()]);
    if (usuarios.length === 0) {
      console.log(`❌ No existe ninguna cuenta con el correo ${email}. Regístrate con ese correo en la app.`);
      process.exit(1);
    }
    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuarios = ?', [hash, usuarios[0].id_usuarios]);
    console.log(`✅ Listo. ${usuarios[0].nombre} (rol: ${usuarios[0].rol}) ya puede entrar con la contraseña nueva.`);
    if (usuarios[0].rol !== 'admin' && process.env.ADMIN_EMAIL && email.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()) {
      console.log('ℹ️  Al iniciar sesión con este correo pasará a ser admin automáticamente.');
    }
  } catch (error) {
    console.log('❌ No se pudo cambiar:', error.message);
  } finally {
    await pool.end();
  }
})();
