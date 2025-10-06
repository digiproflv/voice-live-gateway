import express from "express";
import WebSocket from "ws";
import dotenv from "dotenv";
import fs from "fs";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// ✅ Veselības pārbaude
app.get("/", (req, res) => {
  res.send("🎙️ Voice Live Gateway darbojas! Izmanto POST /speak ar JSON { text: '...' }");
});

// ✅ API: POST /speak
app.post("/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Trūkst parametra 'text'" });

  console.log(`🗣️ Pieprasījums: ${text}`);

  const wsUrl = `wss://${process.env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?TrafficType=VoiceLive`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_VOICE_KEY,
    },
  });

  const audioFile = `/tmp/${randomUUID()}.wav`;
  let completed = false;

  ws.on("open", () => {
    console.log("✅ Savienots ar Microsoft Speech (Voice Live)");

    // Sesijas konfigurācija
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          voice: process.env.VOICE_NAME || "lv-LV-EveritaNeural",
          speech_recognition_language: "lv-LV",
          instructions:
            "Tu esi draudzīgs balss asistents. Runā īsi un saprotami latviešu valodā.",
        },
      })
    );

    // Nosūtām tekstu, ko pārvērst balsī
    setTimeout(() => {
      ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["text", "audio"],
            instructions: text,
          },
        })
      );
    }, 500);
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "response.text.delta") process.stdout.write(data.delta);
    if (data.type === "response.audio.delta") {
      fs.appendFileSync(audioFile, Buffer.from(data.delta, "base64"));
    }

    if (data.type === "response.completed") {
      completed = true;
      console.log("\n🗣️ Balss atbilde pabeigta →", audioFile);

      // Atgriežam WAV straumi atbildē
      res.setHeader("Content-Type", "audio/wav");
      const stream = fs.createReadStream(audioFile);
      stream.pipe(res);
      stream.on("end", () => {
        ws.close();
        fs.unlink(audioFile, () => {}); // dzēšam pagaidu failu
      });
    }
  });

  ws.on("close", () => {
    if (!completed) {
      console.log("⚠️ Voice Live sesija aizvērta pirms audio ģenerēšanas");
      if (!res.headersSent)
        res.status(500).json({ error: "Sesija aizvērta pirms audio ģenerēšanas" });
    }
  });

  ws.on("error", (err) => {
    console.error("❌ Kļūda:", err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "Savienojuma kļūda ar Microsoft Speech" });
  });
});

app.listen(port, () => {
  console.log(`Serveris darbojas uz porta ${port}`);
});
