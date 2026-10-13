import type { FfmpegResult, FfmpegRun, FfmpegTool } from "./ffmpeg.contracts"

/** The ffmpeg port: run the tools and measure a media file. */
export interface Ffmpeg {
    /** Runs ffmpeg or ffprobe and resolves when it exits with code 0. */
    run(tool: FfmpegTool, args: ReadonlyArray<string>, run: FfmpegRun): Promise<FfmpegResult>
    /** Duration of a media file in seconds. */
    probeDuration(file: string, signal: AbortSignal): Promise<number>
}
