# Video rendering resources

- `music/generate.mjs`: regenerates the three music beds (CC0). Encode with `ffmpeg -i x.wav -c:a libmp3lame -b:a 112k be/assets/video/music/x.mp3`.
- `templates/*.json`: starter render specs for the Video module (colour and gradient cards only, so they are valid for any workspace). The UI replaces `brand`, texts and, when the owner uploaded photos, swaps a scene background for `{ "type": "image", "src": "<workspace_id>/<file>" }`.
- `LICENSES.md`: what is bundled and under which licence.
- The spec policy and the renderer are in the back end (`be/src/modules/domain/video/`); the web constants are in `src/modules/video/` and are checked against the policy by `scripts/video-spec-sync.mjs`.
