# Licences of what the video renderer bundles

| Asset | Where | Licence | Notes |
|---|---|---|---|
| Be Vietnam Pro (Regular, SemiBold, Bold, ExtraBold) | `engine/assets/video/fonts/` | SIL Open Font License 1.1 (`OFL.txt` next to the fonts) | (c) 2021 The Be Vietnam Pro Project Authors. Embedding in videos is allowed; the fonts may not be sold on their own. Covers the full Vietnamese range. Taken from the `@expo-google-fonts/be-vietnam-pro` npm package. |
| Music beds `sunny-pop`, `calm-glow`, `bold-beat` | `engine/assets/video/music/` | CC0 1.0 | Synthesised by `resources/video/music/generate.mjs`; no samples. See `engine/assets/video/music/LICENSE.md`. |
| Voiceover | not bundled | Microsoft Edge read-aloud voices through `msedge-tts` | Free, unofficial endpoint: no SLA and it may change or throttle. Replace with a paid provider by implementing `TtsProvider` (engine/src/features/video-render/tts/tts.provider.ts). Generated speech is cached by text hash. |
| ffmpeg | the engine Docker image (`apk add ffmpeg`) | LGPL/GPL build from Alpine | Used as a separate process; nothing is linked into NIVO. libx264 is GPL: do not redistribute the image. |

The engine copies the assets into the image (`COPY assets ./assets`): the Docker build context is `engine/`, so the files the renderer needs live under `engine/assets/video`, not under `resources/`.
