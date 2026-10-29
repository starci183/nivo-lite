import type { EnvSource } from "@modules/platform/config"
import type { AiOptions } from "@modules/integrations/ai"
import type { AiTasksOptions } from "./ai-tasks.options"

const JSON_RETRIES_DEFAULT = 1
const TIMEOUT_DEFAULT_MS = 45_000

/** Reads the prompt library tunables; there is no secret here, the key belongs to the LangChain integration, whose settings ride along as the endpoint. */
export const parseAiTasksConfig = (env: EnvSource, endpoint: AiOptions): AiTasksOptions => ({
    jsonRetries: env.int("AI_JSON_RETRIES", JSON_RETRIES_DEFAULT),
    endpoint,
    timeoutMs: env.duration("AI_TIMEOUT", TIMEOUT_DEFAULT_MS),
})
