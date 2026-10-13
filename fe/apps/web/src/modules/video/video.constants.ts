/** The video spec version the back end renders. */
export const VIDEO_SPEC_VERSION = 1

/** The longest a finished video may run, in seconds. */
export const VIDEO_MAX_SECONDS = 90

/** The most scenes in one video. */
export const VIDEO_MAX_SCENES = 20

/** The most scenes the script editor offers. */
export const SCRIPT_MAX_SCENES = 12

/** The output shapes: vertical, square and wide. */
export const ASPECTS = ["9:16", "1:1", "16:9"] as const

/** One of the output shapes. */
export type Aspect = (typeof ASPECTS)[number]

/** How a scene leaves into the next one. */
export const TRANSITIONS = ["fade", "slide", "wipe", "zoom", "none"] as const

/** One of the scene transitions. */
export type Transition = (typeof TRANSITIONS)[number]

/** How a still image moves. */
export const MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "none"] as const

/** One of the image motions. */
export type Motion = (typeof MOTIONS)[number]

/** Royalty-free tracks bundled with the back end (labels live in the video catalog as music_<id>). */
export const MUSIC_TRACKS = [
    { id: "sunny-pop", bpm: 112 },
    { id: "calm-glow", bpm: 72 },
    { id: "bold-beat", bpm: 124 },
] as const

/** The id of one bundled music track. */
export type MusicTrackId = (typeof MUSIC_TRACKS)[number]["id"]

/** The voices the text to speech offers. */
export const TTS_VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"] as const

/** One of the voices. */
export type TtsVoice = (typeof TTS_VOICES)[number]

/** The private bucket of the images, videos and logos a workspace uploads. */
export const MEDIA_BUCKET = "media"

/** The private bucket of the rendered videos and their posters. */
export const VIDEOS_BUCKET = "videos"

/** The biggest asset one render reads, in bytes. */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024

/** The file types the media bucket accepts. */
export const MEDIA_MIME = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
] as const

/** The lengths the goal step offers, in seconds. */
export const DURATIONS: ReadonlyArray<number> = [15, 20, 30, 45, 60]

/** The shortest target length of a project, in seconds. */
export const TARGET_SECONDS_MIN = 10

/** The longest target length of a project, in seconds. */
export const TARGET_SECONDS_MAX = 90

/** The most videos the library lists. */
export const LIBRARY_LIMIT = 60

/** How long a script may be written before the project is called stuck, in milliseconds. */
export const SCRIPT_STALE_MS = 5 * 60_000

/** The default voice. */
export const DEFAULT_VOICE: TtsVoice = "vi-VN-HoaiMyNeural"
