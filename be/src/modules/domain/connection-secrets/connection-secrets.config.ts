import type { EnvSource } from "@modules/platform/config"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

/** Reads the connection-secrets options: the sealing key has no default. */
export const parseConnectionSecretsConfig = (env: EnvSource): ConnectionSecretsOptions => ({
    tokenKey: env.secret("CHANNEL_TOKEN_KEY"),
})
