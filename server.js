import express from "express";
import WebSocket from "ws";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🎙️ Microsoft Voice Live Gateway darbojas! Pārbaudi konsoli.");
});

app.listen(port, () => console.log(`Serveris darbojas uz porta ${port}`));

// =========================
// Voice Live API Sesija
// =========================

async function startVoiceSession() {
  const wsUrl = `wss://api.voice.live.microsoft.com/v1/realtime?model=${process.env.VOICE_MODEL}`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${process.env.AZURE_VOICE_KEY}`,
      "x-ms-region": process.env.AZURE_REGION,
    },
  });

  ws.on("open", () => {
    console.log("✅ Savienots ar Microsoft Voice Live API");

    // Konfigurācija
    const session = {
      type: "session.update",
      session: {
        voice: process.env.VOICE_NAME,
        speech_recognition_language: "lv-LV",
        instructions:
          "Tu esi draudzīgs latviešu balss asistents. Atbildi īsi un skaidri latviešu valodā.",
      },
    };
    ws.send(JSON.stringify(session));

    // Izveidojām testa jautājumu
    const input = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Sveiks! Kā tev šodien klājas?",
      },
    };
    ws.send(JSON.stringify(input));
  });

  // Datu apstrāde
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "response.text.delta") {
      process.stdout.write(data.delta);
    }

    if (data.type === "response.audio.delta") {
      fs.appendFileSync("response_audio.wav", Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.completed") {
      console.log("\n🗣️ Balss atbilde pabeigta → response_audio.wav");
      ws.close();
    }
  });

  ws.on("close", () => console.log("🔒 Voice Live sesija aizvērta"));
  ws.on("error", (err) => console.error("❌ Kļūda:", err.message));
}

// Automātiski startē sesiju
startVoiceSession();
