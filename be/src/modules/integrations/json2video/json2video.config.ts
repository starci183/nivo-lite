import type { EnvSource } from "@modules/platform/config"
import type { Json2VideoOptions } from "./json2video.options"

/** The REST base of the API (https://json2video.com/docs/v2/reference/api-endpoints/movies-create: `POST https://api.json2video.com/v2/movies`). */
const DEFAULT_API_BASE = "https://api.json2video.com/v2"

/** Reads the JSON2Video options: only tunables live in the environment. */
export const parseJson2VideoConfig = (env: EnvSource): Json2VideoOptions => ({
    apiBase: (env.optional("JSON2VIDEO_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("JSON2VIDEO_API_TIMEOUT", 30_000),
})
