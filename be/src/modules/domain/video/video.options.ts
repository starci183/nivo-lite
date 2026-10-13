/** What the video capability needs from the environment. */
export interface VideoOptions {
    /** Where the bundled fonts and music live (be/assets/video, copied into the image). */
    readonly assetsDir: string
    /** Scratch space for one render; removed when the render ends (stale ones are swept at start). */
    readonly workDir: string
    /** The longest video in seconds the renderer accepts. */
    readonly maxSeconds: number
    /** ffmpeg threads per render. */
    readonly ffmpegThreads: number
}
