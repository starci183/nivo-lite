/** What the ffmpeg integration needs from the environment. */
export interface FfmpegOptions {
    /** Runs ffmpeg under `nice` so a render never starves the api sharing the host. */
    readonly nice: boolean
}
