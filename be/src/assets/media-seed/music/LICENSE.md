# Music beds

`sunny-pop.mp3`, `calm-glow.mp3`, `bold-beat.mp3` were synthesised from scratch by a one-off generator script
(sine/triangle/saw oscillators, noise percussion, no samples, no third-party recordings or melodies), rendered to 44.1 kHz stereo WAV
and encoded with `ffmpeg -i <id>.wav -c:a libmp3lame -b:a 112k <id>.mp3`. The script is no longer in the tree; it is kept in git history
at `fe/apps/web/resources/video/music/generate.mjs` (last present in commit `b07d429e`).
They are released by the NIVO authors under CC0 1.0 (public domain dedication): free to use in videos for any customer, commercially, without attribution.
