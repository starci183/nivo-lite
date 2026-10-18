import { posix, win32 } from "node:path"
import { FfmpegError, FfmpegErrorCode } from "./errors/ffmpeg.error"
import type { FfmpegOptions } from "./ffmpeg.options"
import type { FfmpegTool } from "./ffmpeg.contracts"

/** Checks the operator-owned path without consulting PATH; Windows paths must name a local drive, not a drive-relative path or network share. */
export const absoluteExecutablePath = (path: string, platform: NodeJS.Platform, name: string): string => {
    const absolute =
        platform === "win32" ? win32.isAbsolute(path) && /^[a-z]:[\\/]/iu.test(path) : posix.isAbsolute(path)
    if (!absolute || /[\u0000-\u001f]/u.test(path)) {
        throw new FfmpegError({
            code: FfmpegErrorCode.Failed,
            params: { tool: name, reason: "executable path must be a local absolute path", stderr: "" },
        })
    }
    return path
}

/** Validates every declared executable before any process starts, including a disabled priority wrapper. */
export const validatedFfmpegOptions = (options: FfmpegOptions, platform: NodeJS.Platform): FfmpegOptions => {
    const configuredPath = (path: string | undefined, key: string): string | undefined =>
        path === undefined ? undefined : absoluteExecutablePath(path, platform, key)
    return {
        nice: options.nice,
        ffmpegPath: configuredPath(options.ffmpegPath, "VIDEO_FFMPEG_PATH"),
        ffprobePath: configuredPath(options.ffprobePath, "VIDEO_FFPROBE_PATH"),
        nicePath: configuredPath(options.nicePath, "VIDEO_NICE_PATH"),
    }
}

/** Fixed installation locations support native development and the API image. Alternate installations require explicit trusted paths. */
export const ffmpegExecutablePaths = (
    options: FfmpegOptions,
    platform: NodeJS.Platform,
    arch: string,
): Readonly<Record<FfmpegTool, string> & { nice: string | undefined }> => {
    let directory = "/usr/bin"
    if (platform === "win32") directory = "C:/Program Files/ffmpeg/bin"
    if (platform === "darwin") directory = arch === "arm64" ? "/opt/homebrew/bin" : "/usr/local/bin"
    const suffix = platform === "win32" ? ".exe" : ""
    const ffmpeg = absoluteExecutablePath(options.ffmpegPath ?? `${directory}/ffmpeg${suffix}`, platform, "ffmpeg")
    const ffprobe = absoluteExecutablePath(options.ffprobePath ?? `${directory}/ffprobe${suffix}`, platform, "ffprobe")
    let defaultNice = "/usr/bin/nice"
    if (platform === "linux") defaultNice = "/bin/nice"
    if (platform === "win32") defaultNice = ""
    const nice = options.nice ? absoluteExecutablePath(options.nicePath ?? defaultNice, platform, "nice") : undefined
    return { ffmpeg, ffprobe, nice }
}
