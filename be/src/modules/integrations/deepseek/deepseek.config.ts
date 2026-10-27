import type { EnvSource } from "@modules/platform/config"
import type { DeepseekOptions } from "./deepseek.options"

const JSON_RETRIES_DEFAULT = 1
const POOL_TIMEOUT_DEFAULT_MS = 45_000

/** Reads the prompt library's tunables; there is no secret here, the keys belong to the AI pool. */
export const parseDeepseekConfig = (env: EnvSource): DeepseekOptions => ({
    jsonRetries: env.int("AI_JSON_RETRIES", JSON_RETRIES_DEFAULT),
    poolTimeoutMs: env.duration("AI_POOL_TIMEOUT", POOL_TIMEOUT_DEFAULT_MS),
})
