/** One synthesis request. */
export interface TtsRequest {
    /** The text to speak. */
    readonly text: string
    /** The provider voice id (Edge: vi-VN-HoaiMyNeural or vi-VN-NamMinhNeural). */
    readonly voice: string
    /** The speaking rate relative to normal, in percent (-30..30). */
    readonly ratePct: number
}

/** One voiceover clip on disk. */
export interface TtsClip {
    /** The MP3 file. */
    readonly file: string
    /** True when the clip came from the cache and no provider call was made. */
    readonly cached: boolean
    /** The provider that made the clip. */
    readonly provider: string
}
