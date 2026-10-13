import type { EnvSource } from "@modules/platform/config"
import type { FfmpegOptions } from "./ffmpeg.options"

/** Reads the ffmpeg options: a tunable with a literal default (lowered priority where `nice` exists). */
export const parseFfmpegConfig = (env: EnvSource): FfmpegOptions => ({
    nice: env.bool("VIDEO_FFMPEG_NICE", process.platform === "linux"),
})
