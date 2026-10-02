# Video rendering resources

- `music/generate.mjs`: regenerates the three music beds (CC0). Encode with `ffmpeg -i x.wav -c:a libmp3lame -b:a 112k engine/assets/video/music/x.mp3`.
- `templates/*.json`: starter render specs for the Video module (colour and gradient cards only, so they are valid for any workspace). The UI replaces `brand`, texts and, when the owner uploaded photos, swaps a scene background for `{ "type": "image", "src": "<workspace_id>/<file>" }`.
- `LICENSES.md`: what is bundled and under which licence.
- The spec itself, validator and the app-side client are in `src/lib/video/` (`spec.ts`, `client.ts`, `media.ts`, `server.ts`); the renderer is `engine/src/features/video-render/`.
