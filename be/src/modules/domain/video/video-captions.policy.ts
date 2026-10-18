import { captionCues, VOICE_LEAD } from "./render-plan.policy"
import type { VoiceClip } from "./render-plan.policy"
import type { VideoSpec } from "./video-spec.policy"

/** A nonempty timed track and the known locale of its spoken content, when available. */
export interface VideoCaptions {
    /** UTF-8 WebVTT, escaped as cue text rather than markup. */
    readonly text: string
    /** Actual TTS voice locale; null when any cue is unclassified on-screen text. */
    readonly language: string | null
}

interface CaptionCue {
    readonly start: number
    readonly end: number
    readonly text: string
    readonly spoken: boolean
}

const timestamp = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / 3_600_000)
    const minutes = Math.floor(milliseconds / 60_000) % 60
    const seconds = Math.floor(milliseconds / 1000) % 60
    const part = (value: number): string => String(value).padStart(2, "0")
    return `${part(hours)}:${part(minutes)}:${part(seconds)}.${String(milliseconds % 1000).padStart(3, "0")}`
}

const cueText = (text: string): string =>
    text
        .replace(/\r\n?/gu, "\n")
        .replaceAll(String.fromCodePoint(0), "\uFFFD")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n")
        .trim()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")

/** Builds captions from the very same scene starts and measured voice clips used by the audio mix, bounded by the encoded video. */
export const videoCaptions = (
    spec: VideoSpec,
    starts: ReadonlyArray<number>,
    lengths: ReadonlyArray<number>,
    clips: ReadonlyArray<VoiceClip | null>,
    durationMs: number,
): VideoCaptions | null => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return null
    const cues: Array<CaptionCue> = spec.scenes.flatMap((scene, index): Array<CaptionCue> => {
        const start = starts[index] ?? 0
        const clip = clips[index] ?? null
        if (clip !== null) {
            const voiceStart = Math.round((start + VOICE_LEAD) * 1000) / 1000
            return [
                {
                    start: voiceStart,
                    end: voiceStart + clip.seconds,
                    text: scene.voiceover,
                    spoken: true,
                },
            ]
        }
        const sceneSpec = { ...spec, scenes: [scene] }
        return captionCues(sceneSpec, [start], [lengths[index] ?? 0], [false])
            .filter((cue) => cue.kind !== "brand")
            .map((cue) => ({ ...cue, spoken: false }))
    })
    const usable = cues
        .flatMap((cue) => {
            if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) return []
            const start = Math.max(0, Math.round(cue.start * 1000))
            const end = Math.min(Math.floor(durationMs), Math.round(cue.end * 1000))
            const text = cueText(cue.text)
            return end > start && text !== "" ? [{ start, end, text, spoken: cue.spoken }] : []
        })
        .sort((left, right) => left.start - right.start)
    if (usable.length === 0) return null
    const language = usable.every((cue) => cue.spoken) ? spec.voice.name.split("-").slice(0, 2).join("-") : null
    const blocks = usable.map((cue) => `${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}`)
    return { text: `WEBVTT\n\n${blocks.join("\n\n")}\n`, language }
}
