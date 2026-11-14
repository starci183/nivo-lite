import type { EnvSource } from "@modules/platform/config"
import type { ElevenLabsOptions } from "./elevenlabs.options"

/** The default server of the API reference (https://elevenlabs.io/docs/api-reference/text-to-speech/convert, "Servers"). */
const DEFAULT_API_BASE = "https://api.elevenlabs.io"

/** Reads the ElevenLabs options: only tunables live in the environment. */
export const parseElevenLabsConfig = (env: EnvSource): ElevenLabsOptions => ({
    apiBase: (env.optional("ELEVENLABS_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("ELEVENLABS_API_TIMEOUT", 20_000),
    mediaTimeoutMs: env.duration("ELEVENLABS_MEDIA_TIMEOUT", 120_000),
})
