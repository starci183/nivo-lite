/**
 * The shape of a short shop video, as the video module plans it: the frames it takes, its length bounds, the length of each generated
 * clip and the brand colours it carries. Pure: no I/O, no clock. The clips are made by the video provider; this file only says what the
 * module asks of it.
 */

/** The frames the video provider makes a clip in: vertical and wide. */
export const VIDEO_ASPECTS = ["9:16", "16:9"] as const

/** One frame. */
export type VideoAspect = (typeof VIDEO_ASPECTS)[number]

/** What a video is for: the outline its script follows. */
export const VIDEO_GOALS = ["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"] as const

/** One goal of a video. */
export type VideoGoal = (typeof VIDEO_GOALS)[number]

/** The shortest video a project asks for, in seconds. */
export const VIDEO_MIN_SECONDS = 10

/** The longest video a project asks for, in seconds. */
export const VIDEO_MAX_SECONDS = 90

/** The length a project asks for when it names none, in seconds. */
export const VIDEO_DEFAULT_SECONDS = 30

/** The lengths one generated clip may have, in seconds, shortest first: what the video generation tool takes. */
export const CLIP_SECONDS = [4, 6, 8] as const

/** One clip length. */
export type ClipSeconds = (typeof CLIP_SECONDS)[number]

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu

/** #RGB or #RRGGBB (any case) as #rrggbb lower case, or null for anything else. */
export const normaliseColor = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const match = HEX_COLOR.exec(value.trim())
    if (match === null) return null
    const hex = match.slice(1).join("").toLowerCase()
    return `#${hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex}`
}

/** The frame a stored or asked value names; vertical for anything else. */
export const aspectOf = (value: unknown): VideoAspect => VIDEO_ASPECTS.find((aspect) => aspect === value) ?? "9:16"

/** The goal a stored or asked value names; `custom` for anything else. */
export const goalOf = (value: unknown): VideoGoal => VIDEO_GOALS.find((goal) => goal === value) ?? "custom"

/** The length a project asks for, kept inside the bounds; the default for anything that is not a number. */
export const targetSecondsOf = (value: unknown): number => {
    const asked = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : VIDEO_DEFAULT_SECONDS
    return Math.min(VIDEO_MAX_SECONDS, Math.max(VIDEO_MIN_SECONDS, asked))
}

/** About how long a voice takes to say a text, in seconds (14 characters a second and a short breath): a plan, never a measure. */
export const spokenSecondsOf = (voiceover: string): number => (voiceover.trim() === "" ? 0 : voiceover.length / 14 + 0.8)

/** The longest clip length. */
export const CLIP_SECONDS_MAX: ClipSeconds = 8

/** The clip length a scene needs: the shortest clip that holds its words, else the longest. */
export const clipSecondsOf = (voiceover: string): ClipSeconds => {
    const needed = spokenSecondsOf(voiceover)
    return CLIP_SECONDS.find((seconds) => seconds >= needed) ?? CLIP_SECONDS_MAX
}
