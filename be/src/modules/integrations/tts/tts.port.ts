import type { TtsClip } from "./tts.contracts"

/** The text-to-speech port: a cached, paced voiceover per text. */
export interface Tts {
    /** True when a provider is configured. */
    readonly enabled: boolean
    /** The provider id for the render report: "none" without a provider. */
    readonly providerId: string
    /** The MP3 for this text, from the cache or the provider; throws a `TtsError` when the provider is off or fails. */
    clip(text: string, voice: string, ratePct: number, signal: AbortSignal): Promise<TtsClip>
}
