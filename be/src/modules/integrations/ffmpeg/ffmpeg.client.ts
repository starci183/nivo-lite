import { spawn } from "node:child_process"
import { Injectable } from "@nestjs/common"
import { FfmpegError, FfmpegErrorCode } from "./errors/ffmpeg.error"
import type { FfmpegResult, FfmpegRun, FfmpegTool } from "./ffmpeg.contracts"
import { InjectFfmpegOptions } from "./ffmpeg.decorators"
import type { FfmpegOptions } from "./ffmpeg.options"
import type { Ffmpeg } from "./ffmpeg.port"
import { ffmpegExecutablePaths } from "./ffmpeg-executable.policy"

/** The longest one ffmpeg run may take before it is killed. */
const DEFAULT_TIMEOUT_MS = 20 * 60_000

/** The longest ffprobe may take. */
const PROBE_TIMEOUT_MS = 30_000

/** How much of the end of stderr is kept: the part that tells what failed. */
const STDERR_KEPT = 60_000

/** How much of the end of stderr travels with an error. */
const STDERR_REPORTED = 600

/** The arguments every ffmpeg run starts with; `-progress` is added when the caller wants the timeline. */
const ffmpegArgs = (args: ReadonlyArray<string>, timeline: boolean): Array<string> => [
    "-hide_banner",
    "-nostdin",
    "-y",
    ...(timeline ? ["-progress", "pipe:1", "-nostats"] : []),
    ...args,
]

@Injectable()
/** The only caller of ffmpeg and ffprobe: spawned without a shell, killed on abort or timeout, a non-zero exit is a `FfmpegError` that keeps the stderr tail. */
export class FfmpegClient implements Ffmpeg {
    constructor(@InjectFfmpegOptions() private readonly options: FfmpegOptions) {}

    /** Runs ffmpeg or ffprobe and resolves when it exits with code 0. */
    run(tool: FfmpegTool, args: ReadonlyArray<string>, run: FfmpegRun): Promise<FfmpegResult> {
        return new Promise<FfmpegResult>((resolve, reject) => {
            const stop = AbortSignal.any([run.signal, AbortSignal.timeout(run.timeoutMs ?? DEFAULT_TIMEOUT_MS)])
            const full = tool === "ffmpeg" ? ffmpegArgs(args, run.onTime !== undefined) : [...args]
            const lowered = this.options.nice && run.urgent !== true
            const executables = ffmpegExecutablePaths(this.options, process.platform, process.arch)
            const executable = executables[tool]
            const child =
                lowered && executables.nice !== undefined
                    ? spawn(executables.nice, ["-n", "10", executable, ...full], { cwd: run.cwd })
                    : spawn(executable, full, { cwd: run.cwd })
            let stdout = ""
            let stderr = ""
            let settled = false
            const onAbort = (): void => {
                child.kill("SIGKILL")
                settle(() => reject(failure(run.signal.aborted ? "aborted" : "timeout")))
            }
            const settle = (finish: () => void): void => {
                if (settled) return
                settled = true
                stop.removeEventListener("abort", onAbort)
                finish()
            }
            const failure = (reason: string, cause?: unknown): FfmpegError =>
                new FfmpegError({
                    code: FfmpegErrorCode.Failed,
                    params: { tool, reason, stderr: stderr.slice(-STDERR_REPORTED) },
                    cause,
                })
            stop.addEventListener("abort", onAbort, { once: true })
            child.stdout.on("data", (data: Buffer) => {
                const text = data.toString()
                if (run.onTime === undefined) {
                    stdout += text
                    return
                }
                for (const match of text.matchAll(/out_time_us=(\d+)/gu)) run.onTime(Number(match[1]) / 1e6)
            })
            child.stderr.on("data", (data: Buffer) => {
                stderr = (stderr + data.toString()).slice(-STDERR_KEPT)
            })
            child.on("error", (cause: Error) => settle(() => reject(failure("could not start", cause))))
            child.on("close", (code: number | null) => {
                if (code === 0) settle(() => resolve({ stdout, stderr }))
                else settle(() => reject(failure(`exit ${code ?? "signal"}`)))
            })
        })
    }

    /** Duration of a media file in seconds. */
    async probeDuration(file: string, signal: AbortSignal): Promise<number> {
        const args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]
        const result = await this.run("ffprobe", args, { signal, cwd: ".", timeoutMs: PROBE_TIMEOUT_MS, urgent: true })
        const seconds = Number(result.stdout.trim())
        if (!Number.isFinite(seconds) || seconds <= 0) {
            throw new FfmpegError({
                code: FfmpegErrorCode.Failed,
                params: { tool: "ffprobe", reason: "no duration", stderr: "" },
            })
        }
        return seconds
    }
}
