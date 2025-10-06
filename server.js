import express from "express";
import WebSocket from "ws";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

console.log("ENV CHECK:", {
  AZURE_VOICE_KEY: !!process.env.AZURE_VOICE_KEY,
  AZURE_REGION: process.env.AZURE_REGION,
  VOICE_MODEL: process.env.VOICE_MODEL,
  VOICE_NAME: process.env.VOICE_NAME,
});

const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🎙️ Microsoft Voice Live Gateway darbojas!"));
app.listen(port, () => console.log(`Serveris darbojas uz porta ${port}`));

async function startVoiceSession() {
  const wsUrl = `wss://${process.env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?TrafficType=VoiceLive`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_VOICE_KEY,
    },
  });

  ws.on("open", () => {
    console.log("✅ Savienots ar Microsoft Speech (Voice Live)");

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

    const input = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Sveiks! Kā tev šodien klājas?",
      },
    };
    ws.send(JSON.stringify(input));
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "response.text.delta") process.stdout.write(data.delta);

    if (data.type === "response.audio.delta")
      fs.appendFileSync("response_audio.wav", Buffer.from(data.delta, "base64"));

    if (data.type === "response.completed") {
      console.log("\n🗣️ Balss atbilde pabeigta → response_audio.wav");
      ws.close();
    }
  });

  ws.on("close", () => console.log("🔒 Voice Live sesija aizvērta"));
  ws.on("error", (err) => console.error("❌ Kļūda:", err.message));
}

startVoiceSession();
