import { tmpdir } from "node:os"
import { join } from "node:path"
import type { EnvSource } from "@modules/platform/config"
import type { VideoOptions } from "./video.options"

/** Reads the video options: every value is a tunable with a literal default; the assets directory defaults to `assets/video` under the working directory of the api (`be/` in development). */
export const parseVideoConfig = (env: EnvSource): VideoOptions => ({
    assetsDir: env.optional("VIDEO_ASSETS_DIR") ?? join(process.cwd(), "assets", "video"),
    workDir: env.optional("VIDEO_WORK_DIR") ?? join(tmpdir(), "nivo-video"),
    maxSeconds: Math.min(300, Math.max(10, env.int("VIDEO_MAX_SECONDS", 90))),
    ffmpegThreads: Math.min(16, Math.max(1, env.int("VIDEO_FFMPEG_THREADS", 4))),
})
