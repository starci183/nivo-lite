import type { EnvSource } from "@modules/platform/config"
import type { AiPoolOptions } from "./ai-pool.options"
import { aiPoolOf } from "./ai-pool-config.policy"

/** Reads the AI pool from the environment; no key is required (see `aiPoolOf`). */
export const parseAiPoolConfig = (env: EnvSource): AiPoolOptions => aiPoolOf(env)
