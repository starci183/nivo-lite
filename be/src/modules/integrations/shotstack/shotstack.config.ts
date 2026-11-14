import type { EnvSource } from "@modules/platform/config"
import type { ShotstackOptions } from "./shotstack.options"

/** The Edit API base of the docs (https://shotstack.io/docs/guide/getting-started/request-api-keys/): `{base}/stage` or `{base}/v1`. */
const DEFAULT_API_BASE = "https://api.shotstack.io/edit"

/** Reads the Shotstack options: only tunables live in the environment. */
export const parseShotstackConfig = (env: EnvSource): ShotstackOptions => ({
    apiBase: (env.optional("SHOTSTACK_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("SHOTSTACK_API_TIMEOUT", 30_000),
})
