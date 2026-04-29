# Lip-Sync Options for Web/JavaScript

## Context

The Brunette (v06) model has 15 Oculus visemes + jaw/mouth blendshapes:
```
viseme_sil, viseme_aa, viseme_CH, viseme_DD, viseme_E, viseme_FF,
viseme_I, viseme_kk, viseme_nn, viseme_O, viseme_PP, viseme_RR,
viseme_SS, viseme_TH, viseme_U
+ jawOpen, mouthOpen, mouthClose
```

## Options

### 1. `@met4citizen/headaudio` — Audio-driven viseme detection
- **npm**: `@met4citizen/headaudio`
- **Source**: https://github.com/met4citizen/TalkingHead
- **How**: Web Audio AudioWorklet that analyzes audio in real-time and outputs Oculus viseme weights
- **Input**: Mic stream or audio element
- **Output**: Oculus viseme weights (exact match for v06 model)
- **Pros**: Purpose-built for Ready Player Me avatars with Oculus visemes; same author as the TalkingHead project our v06 avatar comes from
- **Cons**: Newer/less battle-tested; tied to TalkingHead ecosystem
- **Best for**: Our exact use case — mic → RPM avatar visemes

### 2. `wlipsync` — MFCC-based lip-sync via WASM
- **npm**: `wlipsync`
- **Source**: https://github.com/mio3io/wlipsync (port of Unity's uLipSync)
- **How**: Uses MFCC (Mel-frequency cepstral coefficients) to classify audio into viseme categories. Runs as WASM module with Web Audio integration
- **Input**: Real-time mic or audio buffer
- **Output**: Viseme weights (Oculus-compatible)
- **Pros**: Battle-tested algorithm (uLipSync is widely used in Unity); MFCC is more phonetically accurate than raw FFT; lightweight WASM
- **Cons**: WASM binary dependency; may need viseme name mapping
- **Best for**: High-quality real-time mic lip-sync without server

### 3. `rhubarb-lip-sync-wasm` / `lip-sync-engine` — Rhubarb in browser
- **npm**: `rhubarb-lip-sync-wasm` or `lip-sync-engine`
- **Source**: WASM port of https://github.com/DanielSWolf/rhubarb-lip-sync
- **How**: Full speech recognition + phoneme alignment → timed viseme sequence
- **Input**: Audio buffer (not streaming-friendly)
- **Output**: Timed viseme sequence (mouth shapes A-H or Oculus mapping)
- **Pros**: Gold standard for lip-sync quality; actual speech recognition, not just frequency analysis
- **Cons**: Not real-time — processes full audio clips; larger WASM binary; higher latency
- **Best for**: Pre-recorded audio/TTS output, not live mic

### 4. `meyda` — Audio feature extraction toolkit
- **npm**: `meyda`
- **Source**: https://github.com/meyda/meyda
- **How**: General-purpose audio feature extraction (MFCC, spectral centroid, energy, ZCR, etc.) via Web Audio API
- **Input**: Real-time audio stream
- **Output**: Raw audio features (MFCC coefficients, energy bands, etc.) — requires custom viseme mapping on top
- **Pros**: Well-maintained (5+ years); lightweight; no WASM; provides building blocks for custom lip-sync
- **Cons**: Not lip-sync specific — you build the viseme mapping yourself; more work
- **Best for**: Custom audio analysis pipelines; research/experimentation

### 5. Raw Web Audio API + FFT (DIY)
- **Dependencies**: None (built into browsers)
- **How**: `AnalyserNode.getFloatFrequencyData()` → map frequency bands to visemes manually
- **Input**: Mic stream
- **Output**: Custom frequency-band weights
- **Pros**: Zero dependencies; full control; simplest to start
- **Cons**: Least accurate — frequency bands don't map cleanly to phonemes; more "mouth moves when talking" than true lip-sync; lots of manual tuning
- **Best for**: Quick prototype; fallback if other options don't work

### 6. TalkingHead text→viseme modules
- **npm**: `@met4citizen/talkinghead`
- **How**: Language-specific text → phoneme → viseme pipeline (English, Finnish, Lithuanian)
- **Input**: Text string
- **Output**: Timed Oculus viseme sequence
- **Pros**: High quality for TTS workflows; language-aware
- **Cons**: Requires text input, not audio; language-specific modules needed
- **Best for**: Text-to-speech driven animation, chatbot responses

## Comparison Matrix

| Option | Real-time mic | Quality | Dependencies | Complexity | Latency |
|--------|:---:|:---:|:---:|:---:|:---:|
| `@met4citizen/headaudio` | ✅ | ★★★★ | AudioWorklet | Low | <50ms |
| `wlipsync` (MFCC/WASM) | ✅ | ★★★★ | WASM binary | Low | <50ms |
| Rhubarb WASM | ❌ | ★★★★★ | Large WASM | Medium | High |
| `meyda` + custom mapping | ✅ | ★★★ | Lightweight JS | High | <50ms |
| Raw Web Audio FFT | ✅ | ★★ | None | Medium | <16ms |
| TalkingHead text→viseme | ❌ (text only) | ★★★★ | JS modules | Low | N/A |

## Recommendation

For **real-time mic → avatar lip-sync**:
1. **`wlipsync`** — best balance of quality and simplicity; proven MFCC algorithm
2. **`@met4citizen/headaudio`** — best fit for our specific avatar (same ecosystem)

For **TTS/pre-recorded audio**:
1. **Rhubarb WASM** — highest quality phoneme-accurate lip-sync
2. **TalkingHead text→viseme** — if you have the text transcript
