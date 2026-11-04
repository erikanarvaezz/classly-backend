
<div align="center">

# 🐙 Classly

**App móvil de notas escolares con mini juegos de aprendizaje y tutor con inteligencia artificial.**

Hecha para escuelas: los estudiantes ven sus notas y aprenden jugando, los profesores registran notas y crean preguntas, y Dirección administra todo desde su propio panel.

![Android](https://img.shields.io/badge/Android-APK-34E8A0?style=flat-square&logo=android&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK%2057-102442?style=flat-square&logo=expo&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-Express-2DD4C8?style=flat-square&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Aiven-1E3A63?style=flat-square&logo=mysql&logoColor=white)
![Claude](https://img.shields.io/badge/IA-Claude-FF6B81?style=flat-square)

</div>

---

## 📋 Índice

1. [¿Qué es Classly?](#-qué-es-classly)
2. [Funciones por rol](#-funciones-por-rol)
3. [Tecnologías](#-tecnologías)
4. [Arquitectura](#-arquitectura)
5. [Estructura del proyecto](#-estructura-del-proyecto)
6. [Base de datos](#-base-de-datos)
7. [API del backend](#-api-del-backend)
8. [Instalación local](#-instalación-local)
9. [Despliegue en la nube](#-despliegue-en-la-nube)
10. [Generar el APK](#-generar-el-apk)
11. [Scripts útiles](#-scripts-útiles)
12. [Seguridad](#-seguridad)
13. [Diseño](#-diseño)
14. [Equipo](#-equipo)
15. [Créditos](#-créditos)

---

## 💡 ¿Qué es Classly?

Classly es una aplicación móvil para llevar el registro de notas de una escuela. Tiene tres tipos de usuario (**estudiante**, **profesor** y **Dirección**) y cada uno ve una interfaz diferente.

Además de mostrar las notas, Classly busca que el estudiante **aprenda**: incluye un mini juego con tarjetas de memoria y quiz contra reloj, un ranking semanal entre compañeros y un **tutor con IA** que conoce sus notas y le ayuda a estudiar.

La mascota de la app es un **pulpo** 🐙 que reacciona según las notas del estudiante: celebra las buenas, anima cuando hay que mejorar y da consejos.

---

## 👥 Funciones por rol

### 🎒 Estudiante
- **Dashboard de notas:** promedio general grande, cada materia como un anillo de progreso y el pulpo comentando cómo va.
- **Mini juego por materia:**
  - 🃏 *Tarjetas de memoria* para repasar.
  - ⏱️ *Quiz contra reloj* con puntos, racha y confeti al final.
  - Mezcla preguntas creadas por su profesor con un banco fijo incluido en la app.
- **Ranking:** podio semanal y de siempre entre compañeros de la materia, con avatares.
- **Tutor IA:** chat que conoce sus notas, explica temas, da consejos para estudiar y sugiere preguntas rápidas.
- **Personaje:** puede elegir su avatar marino (pez, tortuga, cangrejo, medusa, mantarraya, foca, ajolote…).
- **Notificaciones push** cuando le ponen una nota nueva, lo inscriben en una materia o hay preguntas nuevas para jugar.

### 👩‍🏫 Profesor / Profesora
- **Sus materias:** con número de inscritos y promedio de cada una.
- **Crear materias** desde la app.
- **Registrar notas** (0 a 10) a sus estudiantes, y también **editarlas y borrarlas**.
- **Crear preguntas** para el mini juego de cada materia.
- **Asistente IA:**
  - Chat libre para planificar clases, explicar temas o redactar mensajes.
  - Generador automático de preguntas para el juego.
- **Título automático:** la app detecta por el nombre si mostrar *Profesora* o *Profesor*; si se equivoca, se cambia con un toque.

### 🏫 Dirección (administrador)
- **Crear cuentas de profesores** (los profesores no se registran solos).
- Ver todos los usuarios y **cambiar su rol** (estudiante ⇄ profesor).
- **Restablecer contraseñas** de cualquier usuario.
- Ver todas las materias, su profesor y sus inscritos.
- **Inscribir y quitar estudiantes** de las materias.

> 🔑 **¿Cómo se define quién es Dirección?** Con la variable `ADMIN_EMAIL` del backend. La persona que se registre (o inicie sesión) con ese correo se convierte automáticamente en administradora.

### 🔐 Para todos
- Registro (solo estudiantes) e inicio de sesión con contraseña encriptada.
- Sesión que se mantiene al cerrar la app.
- Opción de recordar el correo.
- Cambiar la contraseña propia.
- Aviso amable cuando el servidor está "despertando".
- Cada correo solo puede registrarse una vez.

---

## 🛠️ Tecnologías

| Parte | Tecnología |
|---|---|
| App móvil | React Native con **Expo SDK 57**, Expo Router, TypeScript |
| Animaciones | React Native Animated (60 fps), react-native-svg |
| Almacenamiento seguro | expo-secure-store (token, sesión) |
| Notificaciones | expo-notifications + Firebase Cloud Messaging (FCM V1) |
| Backend | **Node.js + Express** |
| Base de datos | **MySQL** (diseñada en MySQL Workbench) |
| Autenticación | JSON Web Tokens (JWT) + contraseñas con bcrypt |
| Inteligencia artificial | **Claude (Anthropic)**, modelo `claude-haiku-5-5` |
| Hosting backend | Render (plan gratuito) |
| Hosting base de datos | Aiven for MySQL (plan gratuito, con SSL) |
| Compilación del APK | EAS Build (Expo Application Services) |
| Control de versiones | Git + GitHub (GitHub Desktop) |

---

## 🧭 Arquitectura

```
 ┌──────────────────────┐        HTTPS + JWT        ┌──────────────────────┐
 │   📱 App Classly      │ ────────────────────────▶ │  🖥️ Backend Express   │
 │   (Expo / Android)    │ ◀──────────────────────── │  (Render)             │
 └──────────▲───────────┘                            └───┬─────────┬───────┘
            │                                            │         │
            │ notificaciones push                  SQL + SSL    API de IA
            │                                            │         │
 ┌──────────┴───────────┐                       ┌────────▼───┐ ┌───▼──────────┐
 │ Expo Push + Firebase  │ ◀──── envía avisos ── │ 🗄️ MySQL    │ │ 🤖 Claude     │
 │ (FCM)                 │                       │  (Aiven)    │ │ (Anthropic)  │
 └──────────────────────┘                       └────────────┘ └──────────────┘
```

1. La app manda las peticiones al backend con el **token JWT** del usuario.
2. El backend revisa el token y el **rol** antes de responder (un estudiante nunca puede poner notas, por ejemplo).
3. Los datos se guardan en **MySQL** con conexión cifrada (SSL).
4. Para el tutor y el asistente, el backend llama a **Claude**. La clave de la IA nunca sale del servidor.
5. Cuando pasa algo importante (nota nueva, inscripción, preguntas nuevas), el backend manda una **notificación push**.

---

## 📁 Estructura del proyecto

```
Classly/
├── backend/                     # Servidor Node.js + Express
│   ├── index.js                 # Arranque del servidor y rutas
│   ├── db.js                    # Conexión a MySQL (con SSL)
│   ├── prepararBaseDeDatos.js   # Crea/ajusta tablas y columnas al arrancar
│   ├── notificaciones.js        # Envío de notificaciones push
│   ├── middlewares/auth.js      # verificarToken y permitirRoles
│   ├── ia/claude.js             # Conexión con la IA de Claude
│   ├── rutas/                   # auth, admin, materias, notas, inscripciones,
│   │                            # preguntas, juego, ia, notificaciones
│   ├── sql/                     # Scripts SQL
│   ├── cambiarContrasena.js     # Script: cambiar la contraseña de una cuenta
│   ├── borrarTodosLosUsuarios.js# Script: dejar la base de datos vacía
│   └── probarIA.js              # Script: probar que la IA responde
│
└── frontend/                    # App móvil (Expo)
    ├── app.json / eas.json      # Configuración de la app y del build
    ├── assets/                  # Logo, íconos, avatares e imágenes de materias
    └── src/
        ├── app/                 # Pantallas (Expo Router)
        │   ├── index.tsx        # Login
        │   ├── registro.tsx     # Crear cuenta
        │   ├── contrasena.tsx   # Cambiar contraseña
        │   ├── estudiante/      # Dashboard, juegos, juego, ranking, tutor
        │   ├── profesor/        # Dashboard, materia [id], preguntas, asistente
        │   └── admin/           # Panel de Dirección
        ├── components/          # Pulpo animado, anillos de nota, tarjetas, chat IA…
        ├── services/            # api.ts, notificaciones, sesión
        ├── data/                # Banco de preguntas fijo, imágenes de materias
        ├── utils/               # Cálculo de notas, detector Profesora/Profesor
        └── Theme/colors.ts      # Paleta de colores de la app
```

---

## 🗄️ Base de datos

Base de datos MySQL llamada **`control`**.

| Tabla | Para qué sirve |
|---|---|
| `usuarios` | Cuentas: nombre, correo (único), contraseña encriptada, rol (`estudiante`, `profesor`, `admin`) y avatar |
| `materias` | Materias y el profesor que las imparte |
| `inscripciones` | Qué estudiante está en qué materia |
| `notas` | Notas (0–10) de cada estudiante por materia, con fecha |
| `preguntas` | Preguntas que crea el profesor para el mini juego |
| `puntajes` | Resultados del juego, usados para el ranking y la racha |
| `push_tokens` | Tokens de los celulares para enviar notificaciones |

Las tablas `puntajes` y `push_tokens`, la columna `avatar`, el rol `admin` y el candado de correo único **se crean solos** cuando arranca el servidor (`prepararBaseDeDatos.js`).

---

## 🔌 API del backend

Todas las rutas (menos registro y login) necesitan el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | Público | Crear cuenta de estudiante |
| POST | `/auth/login` | Público | Iniciar sesión (devuelve token y rol) |
| PATCH | `/auth/avatar` | Todos | Cambiar personaje |
| PATCH | `/auth/contrasena` | Todos | Cambiar la contraseña propia |
| GET | `/notas/mis-notas` | Estudiante | Ver sus notas |
| POST | `/notas` | Profesor | Registrar nota |
| PUT / DELETE | `/notas/:id` | Profesor | Editar / borrar nota |
| GET | `/notas/materia/:id` | Profesor | Notas de una materia suya |
| POST | `/materias` | Profesor | Crear materia |
| GET | `/materias/mis-materias` | Profesor | Sus materias con inscritos y promedio |
| GET | `/inscripciones/materia/:id` | Profesor | Estudiantes inscritos |
| POST / GET / DELETE | `/preguntas…` | Profesor (y estudiante para leer) | Preguntas del juego |
| GET | `/juego/resumen` | Estudiante | Puntos, racha y última partida |
| GET | `/juego/ranking` | Estudiante | Ranking semanal o de siempre |
| POST | `/juego/puntajes` | Estudiante | Guardar resultado de una partida |
| POST | `/ia/tutor` | Estudiante | Chat con el tutor IA |
| POST | `/ia/profesor/chat` | Profesor | Chat con el asistente IA |
| POST | `/ia/profesor/preguntas` | Profesor | Generar preguntas con IA |
| GET | `/ia/estado` | Todos | Saber si la IA está activa |
| GET / POST | `/admin/usuarios`, `/admin/profesores` | Dirección | Ver usuarios / crear profesores |
| PATCH | `/admin/usuarios/:id/rol` | Dirección | Cambiar rol |
| PATCH | `/admin/usuarios/:id/contrasena` | Dirección | Restablecer contraseña |
| GET | `/admin/materias`, `/admin/materias/:id/inscritos` | Dirección | Materias e inscritos |
| POST / DELETE | `/admin/inscripciones` | Dirección | Inscribir / quitar estudiantes |
| POST / DELETE | `/notificaciones/token` | Todos | Registrar / quitar el celular para notificaciones |

---

## 💻 Instalación local

### Requisitos
- Node.js 20 o más reciente
- MySQL Server + MySQL Workbench
- Un celular con **Expo Go** o un APK de desarrollo

### 1. Backend
```bash
cd backend
npm install
```
Crea un archivo **`.env`** dentro de `backend` (este archivo **nunca** se sube a GitHub):
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=control
JWT_SECRET=una_frase_larga_y_secreta
PORT=3000
ADMIN_EMAIL=direccion@classly.com
ANTHROPIC_API_KEY=            # vacío = la IA funciona en modo demo
ANTHROPIC_MODEL=claude-haiku-5-5
```
Arranca el servidor:
```bash
npm start
```
Si todo está bien, en `http://localhost:3000` aparece `{"mensaje":"Backend conectado a MySQL"}`.

### 2. App
```bash
cd frontend
npm install
```
En `src/services/api.ts`:
- `USAR_NUBE = false` para usar tu backend local (pon la IP de tu compu en `URL_LOCAL`).
- `USAR_NUBE = true` para usar el servidor en la nube.

```bash
npx expo start
```

---

## ☁️ Despliegue en la nube

| Servicio | Qué tiene | Notas |
|---|---|---|
| **Aiven** | Base de datos MySQL | Conexión con SSL (`ca.pem`). El plan gratis puede **apagarse si no se usa**: se enciende con *Power on*. |
| **Render** | Backend Express (`https://classly-api.onrender.com`) | Se conecta al repositorio de GitHub y se actualiza solo con cada *push*. El plan gratis **se duerme tras 15 min sin uso** y tarda ~1 min en despertar (la app muestra un aviso). |
| **Firebase** | Notificaciones en Android (FCM) | La llave de servicio se sube a Expo → Credentials, nunca al repositorio. |

Variables de entorno en Render: las mismas del `.env` pero con los datos de Aiven, más `DB_SSL_CA_FILE` apuntando al certificado `ca.pem` (subido como *Secret File*).

---

## 📦 Generar el APK

Desde la carpeta `frontend`:
```bash
npx eas-cli build -p android --profile preview
```
- Tarda unos 15 minutos y se compila en la nube de Expo.
- Al terminar da un **link y un código QR** para descargar el APK.
- Cuando pregunte por instalar en un emulador, responder **n**.
- En el celular hay que permitir **"instalar apps desconocidas"** la primera vez.

> Los cambios del **backend** solo necesitan *push* a GitHub (Render se actualiza solo). Los cambios de la **app** necesitan un APK nuevo.

---

## 🧰 Scripts útiles

Dentro de `backend`:

| Comando | Qué hace |
|---|---|
| `node cambiarContrasena.js correo nuevaClave` | Cambia la contraseña de una cuenta (base local) |
| `node cambiarContrasena.js --nube correo nuevaClave` | Lo mismo, en la base de datos de la nube |
| `node borrarTodosLosUsuarios.js --nube` | Deja la base vacía (pide escribir **BORRAR** para confirmar) |
| `node probarIA.js` | Revisa que la clave de Claude funcione |

---

## 🔒 Seguridad

- Contraseñas guardadas con **bcrypt** (nunca en texto plano).
- Acceso protegido con **JWT** y control por **rol** en cada ruta.
- Un profesor solo puede ver y modificar notas de **sus** materias.
- Las notas se validan entre **0 y 10**.
- Cada correo solo puede registrarse **una vez**.
- La clave de la IA vive **solo en el servidor**.
- Conexión a la base de datos con **SSL**.
- **No se suben a GitHub:** `.env`, `ca.pem`, `variables-render.txt`, ni la llave de servicio de Firebase.

---

## 🎨 Diseño

- **Tema oscuro** azul marino con acentos turquesa y verde.

| Color | Uso |
|---|---|
| `#0A1730` | Fondo |
| `#102442` | Tarjetas |
| `#2DD4C8` | Acento principal |
| `#34E8A0` | Notas buenas |
| `#FF6B81` | Alertas y notas bajas |

- Tipografía **Bricolage Grotesque** para títulos y números.
- Animaciones suaves: entradas escalonadas, botones con brillo, tarjetas que se elevan al tocarlas, confeti al ganar.
- Mascota: **pulpo** que reacciona a las notas.

---

## 👩‍💻 Equipo

Proyecto desarrollado por un equipo de 4 personas:

| Área | Integrante |
|---|---|
| Base de datos, backend y app móvil | Erika |
| Diseño | _(nombre)_ |
| Documentación | _(nombre)_ |
| _(área)_ | _(nombre)_ |

---

## 🙏 Créditos

- Íconos de personajes: [Flaticon](https://www.flaticon.com)
- Ilustraciones de materias: [Pixabay](https://pixabay.com)
- Logo y mascota (pulpo): diseño propio del equipo
- Inteligencia artificial: [Claude](https://www.anthropic.com) de Anthropic

Detalles en el archivo `CREDITOS.md` de la carpeta `frontend`.

---

<div align="center">
Hecho con 💙 y un pulpo 🐙 en El Salvador
</div>
