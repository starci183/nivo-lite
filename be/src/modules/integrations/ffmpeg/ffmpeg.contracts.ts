/** The tools the integration runs. */
export type FfmpegTool = "ffmpeg" | "ffprobe"

/** What one ffmpeg or ffprobe run needs. */
export interface FfmpegRun {
    /** Kills the child when it aborts. */
    readonly signal: AbortSignal
    /** The working directory of the child. */
    readonly cwd: string
    /** Output position in seconds, parsed from `-progress` (only for commands that write a timeline). */
    readonly onTime?: (seconds: number) => void
    /** Overrides the kill timeout in milliseconds. */
    readonly timeoutMs?: number
    /** Runs at normal priority even when the integration is configured to lower it (ffprobe does). */
    readonly urgent?: boolean
}

/** What a finished run printed. */
export interface FfmpegResult {
    /** Everything the child wrote to stdout. */
    readonly stdout: string
    /** The end of what the child wrote to stderr. */
    readonly stderr: string
}
