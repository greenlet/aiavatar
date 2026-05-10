# AI Avatar
## Description

Browser-based 3D talking avatar (React + Three.js) wired to a chatbot pipeline:
- **LLM**: Azure OpenAI (`gpt-4o-mini` by default; deployment swappable via env)
- **TTS**: Azure Speech `en-US-JennyNeural` — emits Oculus visemes via the
  `visemeReceived` event for phoneme-perfect lipsync on the v06 model
- **STT**: Azure Speech `SpeechRecognizer` (push-to-talk mic)
- **Gestures**: LLM annotates replies with `[gesture:NAME]` tags from a closed
  list (greeting, waving, thinking, talking_funny, talking_seated,
  standing_idle); browser parser strips them and triggers the matching
  Mixamo-retargeted animation aligned to TTS word boundaries.

The existing HeadAudio mic→viseme path remains as a separate toggle
(useful for "user echo" demos without Azure).

## Environment setup

### Backend (Python)
```
conda create -n aiav_py312 python=3.12
conda activate aiav_py312
pip install -r requirements.txt
cp .env.example .env   # fill in Azure keys
```

Run:
```
uvicorn backend.main:app --reload --port 8000
```

### Frontend (Node)
```
npm install
npm run dev   # vite on :3000, proxies /api → :8000
```

Open http://localhost:3000

## Required Azure resources

| Resource             | Used for                                     |
|----------------------|----------------------------------------------|
| Azure OpenAI         | Chat completions (deploy `gpt-4o-mini`)      |
| Azure AI Speech      | TTS (`visemeReceived`) + STT (mic input)     |

The backend never streams Speech audio itself — it only mints short-lived
auth tokens (`POST /api/speech-token`) for the browser SDK. The browser
talks directly to the Speech endpoint over WebSocket.

