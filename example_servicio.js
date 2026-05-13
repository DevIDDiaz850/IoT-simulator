const { Firestore } = require("@google-cloud/firestore");
const nodemailer = require("nodemailer");

const firestore = new Firestore({ projectId: "proyecto-490818" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "example@gmail.com",
    pass: "ibst zmuq pchi example",
  },
});

exports.registrarTemperatura = async (req, res) => {
  // 1. Manejo de CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  try {
    let data = req.body;
    const temp = parseFloat(data.temperatura);
    if (isNaN(temp)) return res.status(400).send("Temperatura inválida.");

    // --- LÓGICA DE HORARIOS PICO (SONORA UTC-7) ---
    const fechaActual = new Date();
    // Ajuste manual a hora de Sonora (UTC-7)
    const horaSonora = new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Hermosillo",
    }).format(fechaActual);

    const hora = parseInt(horaSonora);
    let modoEnergia = "Estándar";
    let consignaTermostato = "Mantener";

    // Estrategia Peak Shaving
    if (hora === 13) {
      modoEnergia = "Pre-enfriamiento";
      consignaTermostato = "Bajar al máximo (Preparación para Horario Pico)";
    } else if (hora >= 14 && hora <= 18) {
      modoEnergia = "Ahorro (Peak Shaving)";
      consignaTermostato =
        "Subir ligeramente (Evitar arranque de compresor caro)";
    }

    // --- LÓGICA DE ESTADO Y CORREO CRÍTICO ---
    const estado = temp > 4.5 ? "Crítico" : "Normal";

    // Guardar en Firestore
    const docRef = firestore.collection("ahorro").doc("sensor_frigorifico");
    await docRef.set({
      temperatura: temp,
      estado: estado,
      modo_energia: modoEnergia,
      ultima_actualizacion: fechaActual.toISOString(),
    });

    // ENVIAR CORREO SOLO SI ES CRÍTICO
    if (estado === "Crítico") {
      const mailOptions = {
        from: '"Sistema DEV-ID Sonora" <example@gmail.com>',
        to: "example@unav.edu.mx",
        subject: `🚨 ALERTA CRÍTICA: ${temp}°C detectados`,
        html: `
          <div style="font-family: sans-serif; border: 2px solid #d32f2f; padding: 20px; border-radius: 10px;">
            <h2 style="color: #d32f2f;">Estado del Sensor: CRÍTICO</h2>
            <p>Se ha detectado una temperatura fuera de rango (4.5°C) en el frigorífico.</p>
            <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${temp}°C</div>
            <hr>
            <h3>📋 Indicaciones de Emergencia:</h3>
            <ul>
              <li><strong>Verificar cierre:</strong> Revise sellos y puertas inmediatamente.</li>
              <li><strong>Estado del compresor:</strong> Verifique si hay ruido de operación.</li>
              <li><strong>Modo actual:</strong> El sistema está en modo <em>${modoEnergia}</em>.</li>
            </ul>
            <p style="font-size: 11px; color: #777;">Hora Sonora registrada: ${hora}:00 hrs</p>
          </div>
        `,
      };
      await transporter.sendMail(mailOptions);
      console.log("Correo crítico enviado.");
    }

    // 5. Respuesta al Sensor (Para que el termostato sepa qué hacer)
    return res.status(201).json({
      status: "success",
      estado: estado,
      estrategia: modoEnergia,
      instruccion_termostato: consignaTermostato,
      hora_local: hora,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error interno");
  }
};
