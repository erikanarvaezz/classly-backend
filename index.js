const express = require('express');
const cors = require('cors');
require('dotenv').config({ override: true }); // el .env manda sobre las variables de Windows
const authRutas = require('./rutas/auth');
const materiasRutas = require('./rutas/materias');
const notasRutas = require('./rutas/notas');
const inscripcionesRutas = require('./rutas/inscripciones');
const preguntasRutas = require('./rutas/preguntas');
const adminRutas = require('./rutas/admin');
const iaRutas = require('./rutas/ia');
const juegoRutas = require('./rutas/juego');
const notificacionesRutas = require('./rutas/notificaciones');
const prepararBaseDeDatos = require('./prepararBaseDeDatos');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/auth', authRutas);
app.use('/inscripciones', inscripcionesRutas);
app.use('/materias', materiasRutas);
app.use('/notas', notasRutas);
app.use('/preguntas', preguntasRutas);
app.use('/admin', adminRutas);
app.use('/ia', iaRutas);
app.use('/juego', juegoRutas);
app.use('/notificaciones', notificacionesRutas);


app.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT 1 + 1 AS resultado');
  res.json({ mensaje: 'Backend conectado a MySQL', prueba: rows[0] });
});

app.listen(process.env.PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
  await prepararBaseDeDatos();
  console.log(process.env.ANTHROPIC_API_KEY ? '🤖 IA conectada (Claude)' : '🤖 IA en modo demo (falta ANTHROPIC_API_KEY en el .env)');
});