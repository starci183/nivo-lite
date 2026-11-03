import type { EnvSource } from "@modules/platform/config"
import type { IdentityAuthOptions } from "./identity-auth.options"

const RESET_TTL_SECONDS = 3600
const INVITE_TTL_SECONDS = 604_800

/** Reads the sign-in options of identity: the web origin is required, the link lifetimes are optional. */
export const parseIdentityAuthConfig = (env: EnvSource): IdentityAuthOptions => ({
    webOrigin: new URL(env.url("AUTH_WEB_ORIGIN")).origin,
    resetTtlSeconds: env.int("AUTH_RESET_TTL_SECONDS", RESET_TTL_SECONDS),
    inviteTtlSeconds: env.int("AUTH_INVITE_TTL_SECONDS", INVITE_TTL_SECONDS),
})
