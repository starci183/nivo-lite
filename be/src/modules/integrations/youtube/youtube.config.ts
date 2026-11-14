import type { EnvSource } from "@modules/platform/config"
import type { YoutubeOptions } from "./youtube.options"

/** The origin of the endpoints the YouTube reference pages list (`https://www.googleapis.com/...`). */
const DEFAULT_API_BASE = "https://www.googleapis.com"

/** Reads the YouTube options: only tunables live in the environment. */
export const parseYoutubeConfig = (env: EnvSource): YoutubeOptions => ({
    apiBase: (env.optional("YOUTUBE_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("YOUTUBE_API_TIMEOUT", 30_000),
    uploadTimeoutMs: env.duration("YOUTUBE_UPLOAD_TIMEOUT", 600_000),
    maxUploadBytes: env.int("YOUTUBE_UPLOAD_MAX_BYTES", 536_870_912),
})
