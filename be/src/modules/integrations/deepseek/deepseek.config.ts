import type { EnvSource } from "@modules/platform/config"
import type { DeepseekOptions } from "./deepseek.options"

const JSON_RETRIES_DEFAULT = 1

/** Reads the prompt library's tunables; there is no secret here, OpenClaw is the only text AI. */
export const parseDeepseekConfig = (env: EnvSource): DeepseekOptions => ({
    jsonRetries: env.int("AI_JSON_RETRIES", JSON_RETRIES_DEFAULT),
})
