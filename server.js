import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// ✅ Veselības pārbaude
app.get("/", (req, res) => {
  res.send("🎙️ Azure Speech TTS Gateway darbojas! Izmanto POST /tts ar JSON { text: '...' }");
});

// ✅ Azure TTS (klasiskais REST API)
app.post("/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Trūkst parametra 'text'" });

  console.log("🗣️ Teksts:", text);

  try {
    const url = `https://${process.env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = `
      <speak version='1.0' xml:lang='lv-LV'>
        <voice name='${process.env.VOICE_NAME || "lv-LV-EveritaNeural"}'>
          ${text}
        </voice>
      </speak>`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_VOICE_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
      },
      body: ssml,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ Kļūda:", err);
      return res.status(500).json({ error: "Azure TTS kļūda", details: err });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = "speech.wav";
    fs.writeFileSync(fileName, buffer);

    console.log("✅ Audio ģenerēts →", fileName);

    res.setHeader("Content-Type", "audio/wav");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Izpildes kļūda:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Serveris darbojas uz porta ${port}`));
