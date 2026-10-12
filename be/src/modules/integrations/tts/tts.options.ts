/** The text-to-speech provider in use: Microsoft Edge read-aloud, or none (captions only). */
export type TtsProviderId = "edge" | "none"

/** What the text-to-speech integration needs from the environment. */
export interface TtsOptions {
    /** "edge" = Microsoft Edge read-aloud (free, no key); "none" = captions only. A paid provider plugs into `tts.client.ts`. */
    readonly provider: TtsProviderId
    /** The clip cache, keyed by provider, voice, rate and text hash; a volume in production so a re-render of one script costs no call. */
    readonly cacheDir: string
    /** The fallback directory for a clip when the cache directory cannot be written. */
    readonly workDir: string
    /** The pause between two provider requests in milliseconds (Edge throttles bursts). */
    readonly minGapMs: number
}
