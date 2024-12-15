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

  const resetLink = `http://10.0.2.2:8200/reset-password?token=${token}`;


  transporter.sendMail(
    {
      from: '"Soporte" <v.cisternasob@gmail.com>',
      to: email,
      subject: "Recuperación de contraseña",
      html: `<p>Haz clic en el enlace para restablecer tu contraseña:</p>
             <a href="${resetLink}">${resetLink}</a>`,
    },
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Error al enviar el correo" });
      }
      res.json({ message: "Correo enviado con éxito" });
    }
  );
});

// Ruta para restablecer contraseña
server.post("/auth/reset-password", (req, res) => {
  const { token, password } = req.body;

  const db = router.db;
  let user = db.get("usuarios").find(u => u.resetToken === token && u.resetTokenExpiry > Date.now()).value() ||
             db.get("gestores").find(u => u.resetToken === token && u.resetTokenExpiry > Date.now()).value();

  if (!user) {
    return res.status(400).json({ message: "Token inválido o expirado" });
  }

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

server.use(router);
server.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
