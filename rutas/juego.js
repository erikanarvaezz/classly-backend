const express = require('express');
const pool = require('../db');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(verificarToken, permitirRoles('estudiante'));

// "Ana María López" -> "Ana L." (para mostrar en el ranking)
function nombreCorto(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/);
  if (partes.length < 2) return partes[0] || 'Estudiante';
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

async function estaInscrito(materia_id, estudiante_id) {
  const [filas] = await pool.query('SELECT 1 FROM inscripciones WHERE materia_id = ? AND estudiante_id = ?', [
    materia_id,
    estudiante_id,
  ]);
  return filas.length > 0;
}

// RESUMEN para la pantalla de inicio de juegos
router.get('/resumen', async (req, res) => {
  try {
    const yo = req.usuario.id;
    const [materias] = await pool.query(
      `SELECT m.id_materia, m.nombre,
        (SELECT AVG(n.valor) FROM notas n WHERE n.materia_id = m.id_materia AND n.estudiante_id = ?) AS promedio,
        (SELECT COUNT(*) FROM preguntas p WHERE p.materia_id = m.id_materia) AS preguntas,
        (SELECT COALESCE(SUM(pu.puntos), 0) FROM puntajes pu WHERE pu.materia_id = m.id_materia AND pu.estudiante_id = ?) AS puntos
       FROM inscripciones i JOIN materias m ON i.materia_id = m.id_materia
       WHERE i.estudiante_id = ?
       ORDER BY m.nombre`,
      [yo, yo, yo]
    );

    const [ranking] = await pool.query(
      `SELECT u.id_usuarios, COALESCE(SUM(pu.puntos), 0) AS total
       FROM usuarios u LEFT JOIN puntajes pu ON pu.estudiante_id = u.id_usuarios
       WHERE u.rol = 'estudiante'
       GROUP BY u.id_usuarios
       ORDER BY total DESC, u.id_usuarios`
    );
    const [[semana]] = await pool.query(
      'SELECT COALESCE(SUM(puntos), 0) AS puntos FROM puntajes WHERE estudiante_id = ? AND creado_en >= NOW() - INTERVAL 7 DAY',
      [yo]
    );

    // Racha: días seguidos (hasta hoy o ayer) en los que jugó al menos una partida
    const [dias] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(creado_en, '%Y-%m-%d') AS dia FROM puntajes
       WHERE estudiante_id = ? ORDER BY dia DESC LIMIT 400`,
      [yo]
    );
    const [[{ hoy }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const jugados = new Set(dias.map((d) => d.dia));
    const restarDia = (txt) => {
      const f = new Date(`${txt}T12:00:00Z`);
      f.setUTCDate(f.getUTCDate() - 1);
      return f.toISOString().slice(0, 10);
    };
    let cursor = jugados.has(hoy) ? hoy : restarDia(hoy);
    let racha_dias = 0;
    while (jugados.has(cursor)) {
      racha_dias += 1;
      cursor = restarDia(cursor);
    }

    // Última partida jugada
    const [ultimas] = await pool.query(
      `SELECT pu.materia_id, m.nombre, pu.aciertos, pu.total, pu.puntos
       FROM puntajes pu JOIN materias m ON m.id_materia = pu.materia_id
       WHERE pu.estudiante_id = ? ORDER BY pu.creado_en DESC, pu.id_puntaje DESC LIMIT 1`,
      [yo]
    );

    const [[yoFila]] = await pool.query('SELECT avatar FROM usuarios WHERE id_usuarios = ?', [yo]);

    const puesto = ranking.findIndex((r) => r.id_usuarios === yo) + 1;
    res.json({
      puntos_total: Number(ranking.find((r) => r.id_usuarios === yo)?.total || 0),
      puntos_semana: Number(semana.puntos),
      puesto: puesto || ranking.length,
      total_estudiantes: ranking.length,
      racha_dias,
      avatar: yoFila?.avatar || null,
      jugo_hoy: jugados.has(hoy),
      ultima: ultimas[0] || null,
      materias: materias.map((m) => ({
        id_materia: m.id_materia,
        nombre: m.nombre,
        promedio: m.promedio === null ? null : Number(m.promedio),
        preguntas: Number(m.preguntas),
        puntos: Number(m.puntos),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar el resumen', detalle: error.message });
  }
});

// RANKING general o por materia, de la semana o de siempre
router.get('/ranking', async (req, res) => {
  try {
    const materia_id = req.query.materia_id ? Number(req.query.materia_id) : null;
    const semana = req.query.periodo === 'semana';
    const filtroFecha = semana ? 'AND pu.creado_en >= NOW() - INTERVAL 7 DAY' : '';

    let filas;
    if (materia_id) {
      if (!(await estaInscrito(materia_id, req.usuario.id))) {
        return res.status(403).json({ error: 'No estás inscrito en esta materia' });
      }
      [filas] = await pool.query(
        `SELECT u.id_usuarios, u.nombre, u.avatar, COALESCE(SUM(pu.puntos), 0) AS puntos
         FROM inscripciones i
         JOIN usuarios u ON u.id_usuarios = i.estudiante_id
         LEFT JOIN puntajes pu ON pu.estudiante_id = u.id_usuarios AND pu.materia_id = i.materia_id ${filtroFecha}
         WHERE i.materia_id = ?
         GROUP BY u.id_usuarios, u.nombre, u.avatar
         ORDER BY puntos DESC, u.nombre
         LIMIT 50`,
        [materia_id]
      );
    } else {
      [filas] = await pool.query(
        `SELECT u.id_usuarios, u.nombre, u.avatar, COALESCE(SUM(pu.puntos), 0) AS puntos
         FROM usuarios u
         LEFT JOIN puntajes pu ON pu.estudiante_id = u.id_usuarios ${filtroFecha}
         WHERE u.rol = 'estudiante'
         GROUP BY u.id_usuarios, u.nombre, u.avatar
         ORDER BY puntos DESC, u.nombre
         LIMIT 50`
      );
    }

    res.json(
      filas.map((f, i) => ({
        puesto: i + 1,
        nombre: nombreCorto(f.nombre),
        puntos: Number(f.puntos),
        avatar: f.avatar || null,
        yo: f.id_usuarios === req.usuario.id,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar el ranking', detalle: error.message });
  }
});

// GUARDAR el puntaje de una partida
router.post('/puntajes', async (req, res) => {
  try {
    const materia_id = Number(req.body.materia_id);
    const total = Math.round(Number(req.body.total));
    const aciertos = Math.round(Number(req.body.aciertos));
    const puntos = Math.round(Number(req.body.puntos));

    const valido =
      materia_id > 0 &&
      total >= 1 && total <= 20 &&
      aciertos >= 0 && aciertos <= total &&
      puntos >= 0 && puntos <= aciertos * 500; // tope para evitar trampas
    if (!valido) return res.status(400).json({ error: 'Puntaje no válido' });

    if (!(await estaInscrito(materia_id, req.usuario.id))) {
      return res.status(403).json({ error: 'No estás inscrito en esta materia' });
    }

    await pool.query(
      'INSERT INTO puntajes (estudiante_id, materia_id, puntos, aciertos, total) VALUES (?, ?, ?, ?, ?)',
      [req.usuario.id, materia_id, puntos, aciertos, total]
    );
    res.status(201).json({ mensaje: 'Puntaje guardado' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar el puntaje', detalle: error.message });
  }
});

module.exports = router;
