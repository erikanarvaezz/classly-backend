const mysql = require('mysql2/promise');
require('dotenv').config();

// Conexión segura (SSL) para la base de datos en la nube (Aiven).
// - DB_SSL_CA: el certificado "CA" que da Aiven (recomendado)
// - DB_SSL=true: SSL sin verificar certificado (solo si no hay CA)
// En tu compu no se pone ninguna de las dos y funciona igual que siempre.
let ssl;
if (process.env.DB_SSL_CA) {
  ssl = { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') };
} else if (process.env.DB_SSL === 'true') {
  ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: 5,
});

module.exports = pool;
