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

## Deployment (Azure Container Apps)

Single container hosts both the built Vite frontend and the FastAPI backend on the
same origin. Image is built remotely by ACR Tasks (`remoteBuild: true` in
`azure.yaml`), so no local Docker is required.

**Live URL:**
🔗 https://ca-aiavatar-o6zrhqcb.happyflower-b1f771c7.westeurope.azurecontainerapps.io/

**Deployment coordinates:**

| Item | Value |
|------|-------|
| Subscription | Visual Studio Enterprise (`7196d609-dac8-4419-b0ce-8052048a42a2`) |
| Tenant | `f900170c-7dd2-448c-841a-1349081a23cd` |
| Resource group | `rg-aiavatar` |
| Region | `westeurope` |
| azd environment | `aiavatar` |
| Container App | `ca-aiavatar-o6zrhqcb` |
| Container Apps Environment | `cae-aiavatar-o6zrhqcb` |
| Container Registry | `acraiavataro6zrhqcb` (Basic, admin user enabled) |
| Log Analytics workspace | `log-aiavatar-o6zrhqcb` |
| Sizing | 0.5 vCPU / 1.0 GiB, min=0 max=1 (scale-to-zero) |
| Auth to AI services | API keys stored as Container App secrets (no managed identity) |
| Cold start | ~5–60s on first request after idle |
| Approx. cost | ~$5/mo (ACR Basic + minimal LAW; ACA scales to zero) |

Infra files: `infra/main.bicep`, `infra/resources.bicep`, `infra/main.parameters.json`.
Container build: `Dockerfile` (multi-stage `node:22-alpine` → `python:3.12-slim`).
Deployment plan: `.azure/deployment-plan.md`.

## Commands

### Local development

```bash
# Backend (terminal 1)
conda activate aiav_py312
uvicorn backend.main:app --reload --port 8000

# Frontend (terminal 2)
npm run dev                       # vite on :3000, proxies /api → :8000
```

Open http://localhost:3000.

### Build & lockfile

```bash
npm run build                     # Vite build → dist/ (used by Docker stage 1)

# Regenerate package-lock.json (do BOTH steps or transitive @emnapi/* deps end
# up missing and ACR Tasks `npm ci` fails):
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund
```

### Azure deployment

```bash
# One-time setup
brew tap azure/azd && brew install azure-cli azd
az login                          # interactive browser
azd auth login                    # separate token cache from az

# Select existing environment (or use `azd env new <name>` for a fresh one)
azd env select aiavatar

# Inspect / set environment variables
azd env get-values
azd env set <KEY> <VALUE>

# Validate before deploying (what-if + package check)
azd provision --preview --no-prompt
azd package --no-prompt

# Deploy code-only (~2 min, image built remotely by ACR Tasks)
azd deploy --no-prompt

# Deploy infra + code (~3–5 min)
azd up --no-prompt

# Tear everything down (DESTRUCTIVE — deletes RG + all resources)
azd down --purge --force
```

### Operations & diagnostics

```bash
# Tail container logs (live)
az containerapp logs show \
  -n ca-aiavatar-o6zrhqcb -g rg-aiavatar --follow

# List all resources in the RG
az resource list -g rg-aiavatar -o table

# Show current container app revision + replica state
az containerapp show \
  -n ca-aiavatar-o6zrhqcb -g rg-aiavatar \
  --query "{fqdn:properties.configuration.ingress.fqdn, revision:properties.latestRevisionName, replicas:properties.template.scale}" \
  -o jsonc

# Restart the app (force a new revision from current image)
az containerapp revision restart \
  -n ca-aiavatar-o6zrhqcb -g rg-aiavatar \
  --revision $(az containerapp show -n ca-aiavatar-o6zrhqcb -g rg-aiavatar --query properties.latestRevisionName -o tsv)

# Rotate a secret (e.g. after an OpenAI key roll)
azd env set AZURE_OPENAI_API_KEY "<new-key>"
azd provision --no-prompt         # updates the Container App secret in place

# Smoke-test the live deployment
URL=https://ca-aiavatar-o6zrhqcb.happyflower-b1f771c7.westeurope.azurecontainerapps.io
curl -s $URL/api/health | jq
curl -sI $URL/v06/model.glb | head -3
curl -sX POST $URL/api/speech-token | jq '{region, token_len: (.token | length)}'
```


