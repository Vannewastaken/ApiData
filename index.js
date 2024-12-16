const jsonServer = require("json-server");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const server = jsonServer.create();
const router = jsonServer.router("almacen.json");
const middlewares = jsonServer.defaults();
const port = process.env.PORT || 10000;

server.use(jsonServer.bodyParser);
server.use(middlewares);

// Configuración para enviar correos
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "v.cisternasob@gmail.com", // Cambia por tu correo
    pass: "eyid nglg zmkk dvkz", // Cambia por tu contraseña de aplicación
  },
});

// Ruta para solicitar recuperación de contraseña
server.post("/auth/forgot-password", (req, res) => {
  const { email } = req.body;

  const db = router.db; // Base de datos JSON
  let user = db.get("usuarios").find({ email }).value() ||
             db.get("gestores").find({ email }).value();

  if (!user) {
    return res.status(404).json({ message: "Correo no registrado" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + 3600000; // 1 hora

  // Asigna el token y su vencimiento al usuario correspondiente
  if (db.get("usuarios").find({ email }).value()) {
    db.get("usuarios")
      .find({ email })
      .assign({ resetToken: token, resetTokenExpiry: expiry })
      .write();
  } else {
    db.get("gestores")
      .find({ email })
      .assign({ resetToken: token, resetTokenExpiry: expiry })
      .write();
  }

  // Enlace HTTPS intermedio
  const resetLink = `https://miapp.com/reset-password?token=${token}`;

  transporter.sendMail(
    {
      from: '"Soporte" <v.cisternasob@gmail.com>',
      to: email,
      subject: "Recuperación de contraseña",
      html: `
        <p>Haz clic en el enlace para restablecer tu contraseña:</p>
        <a href="${resetLink}" style="color: blue; text-decoration: underline;">Restablecer Contraseña</a>
        <p>Si tienes problemas, copia y pega este enlace en tu navegador:</p>
        <p>${resetLink}</p>
      `,
    },
    (err) => {
      if (err) {
        console.error("Error al enviar el correo:", err);
        return res.status(500).json({ message: "Error al enviar el correo" });
      }
      res.json({ message: "Correo enviado con éxito" });
    }
  );
});

// Ruta para redirigir desde HTTPS al esquema personalizado
server.get("/reset-password", (req, res) => {
  const token = req.query.token; // Captura el token desde los parámetros
  if (!token) {
    return res.status(400).send("Token no proporcionado");
  }
  console.log("Redirigiendo a esquema personalizado con token:", token);
  // Redirige al esquema personalizado de la app
  res.redirect(`miapp://reset-password?token=${token}`);
});

// Ruta para restablecer contraseña
server.post("/auth/reset-password", (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: "Token o contraseña no proporcionados" });
  }

  const db = router.db;
  let user = db.get("usuarios").find(u => u.resetToken === token && u.resetTokenExpiry > Date.now()).value() ||
             db.get("gestores").find(u => u.resetToken === token && u.resetTokenExpiry > Date.now()).value();

  if (!user) {
    return res.status(400).json({ message: "Token inválido o expirado" });
  }

  // Restablece la contraseña y elimina el token
  if (db.get("usuarios").find({ resetToken: token }).value()) {
    db.get("usuarios")
      .find({ resetToken: token })
      .assign({ password, resetToken: null, resetTokenExpiry: null })
      .write();
  } else {
    db.get("gestores")
      .find({ resetToken: token })
      .assign({ password, resetToken: null, resetTokenExpiry: null })
      .write();
  }

  res.json({ message: "Contraseña restablecida con éxito" });
});

// Middleware para loguear solicitudes
server.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Configuración del servidor
server.use(router);
server.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
