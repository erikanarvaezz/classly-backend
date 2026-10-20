const pool = require('./db');

// Se ejecuta al arrancar el servidor. Se asegura de que la columna "rol"
// de la tabla usuarios acepte el valor 'admin' (sin tener que abrir Workbench).
async function prepararBaseDeDatos() {
  try {
    const [columnas] = await pool.query(
      `SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'rol'`
    );

    if (columnas.length === 0) {
      console.log('⚠️  No encontré la columna rol en la tabla usuarios.');
      return;
    }

    const col = columnas[0];
    const nulo = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    const porDefecto = col.COLUMN_DEFAULT ? ` DEFAULT ${pool.escape(String(col.COLUMN_DEFAULT).replace(/^'|'$/g, ''))}` : '';

    if (col.DATA_TYPE === 'enum' && !col.COLUMN_TYPE.includes("'admin'")) {
      const nuevoTipo = col.COLUMN_TYPE.replace(/\)$/, ",'admin')");
      await pool.query(`ALTER TABLE usuarios MODIFY rol ${nuevoTipo} ${nulo}${porDefecto}`);
      console.log('✅ La columna rol ahora acepta "admin".');
    } else if (['varchar', 'char'].includes(col.DATA_TYPE) && col.CHARACTER_MAXIMUM_LENGTH < 10) {
      await pool.query(`ALTER TABLE usuarios MODIFY rol VARCHAR(20) ${nulo}${porDefecto}`);
      console.log('✅ La columna rol se amplió para aceptar "admin".');
    }

    await crearTablaPuntajes();
    await asegurarColumnaAvatar();

    if (!process.env.ADMIN_EMAIL) {
      console.log('ℹ️  Falta ADMIN_EMAIL en el archivo .env: todavía nadie puede ser administrador.');
    } else {
      console.log(`👑 Administrador configurado: ${process.env.ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.log('⚠️  No pude preparar la base de datos para el administrador:', error.message);
  }
}

// Tabla para el ranking del mini juego (se crea sola si no existe)
async function crearTablaPuntajes() {
  const columnas = `
    id_puntaje INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    materia_id INT NOT NULL,
    puntos INT NOT NULL,
    aciertos INT NOT NULL,
    total INT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_puntajes_materia (materia_id),
    INDEX idx_puntajes_estudiante (estudiante_id)`;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS puntajes (${columnas},
      FOREIGN KEY (estudiante_id) REFERENCES usuarios(id_usuarios) ON DELETE CASCADE,
      FOREIGN KEY (materia_id) REFERENCES materias(id_materia) ON DELETE CASCADE)`);
  } catch (error) {
    // Si las llaves foráneas no coinciden en tipo, se crea igual sin ellas
    await pool.query(`CREATE TABLE IF NOT EXISTS puntajes (${columnas})`);
  }
}

// Columna para el personaje (avatar) que elige cada usuario
async function asegurarColumnaAvatar() {
  const [[{ existe }]] = await pool.query(
    `SELECT COUNT(*) AS existe FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'avatar'`
  );
  if (!existe) {
    await pool.query('ALTER TABLE usuarios ADD COLUMN avatar VARCHAR(30) NULL');
    console.log('✅ Se agregó la columna avatar a usuarios.');
  }
}

module.exports = prepararBaseDeDatos;
