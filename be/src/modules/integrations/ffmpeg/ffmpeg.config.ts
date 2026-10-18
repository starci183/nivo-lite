import type { EnvSource } from "@modules/platform/config"
import type { FfmpegOptions } from "./ffmpeg.options"
import { validatedFfmpegOptions } from "./ffmpeg-executable.policy"

/** Reads the ffmpeg options: a tunable with a literal default (lowered priority where `nice` exists). */
export const parseFfmpegConfig = (env: EnvSource): FfmpegOptions =>
    validatedFfmpegOptions(
        {
            nice: env.bool("VIDEO_FFMPEG_NICE", process.platform === "linux"),
            ffmpegPath: env.optional("VIDEO_FFMPEG_PATH"),
            ffprobePath: env.optional("VIDEO_FFPROBE_PATH"),
            nicePath: env.optional("VIDEO_NICE_PATH"),
        },
        process.platform,
    )
