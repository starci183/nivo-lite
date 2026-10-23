/** What the ffmpeg integration needs from the environment. */
export interface FfmpegOptions {
    /** Runs ffmpeg under `nice` so a render never starves the api sharing the host. */
    readonly nice: boolean
    /** Trusted operator-installed executable; an absolute local path, never a PATH entry. */
    readonly ffmpegPath?: string | undefined
    /** Trusted operator-installed probe executable; an absolute local path. */
    readonly ffprobePath?: string | undefined
    /** Absolute local nice executable; required on Windows only when nice is enabled. */
    readonly nicePath?: string | undefined
}
