import type { EnvSource } from "@modules/platform/config"
import type { IdentityAuthOptions } from "./identity-auth.options"

const REFRESH_TTL_SECONDS = 2_592_000
const RESET_TTL_SECONDS = 3600
const INVITE_TTL_SECONDS = 604_800
const LOGIN_ATTEMPTS = 10
const RESET_ATTEMPTS = 5

/** Reads the sign-in options: the web origin is required, the cookie domain and the tunables are optional. */
export const parseIdentityAuthConfig = (env: EnvSource): IdentityAuthOptions => ({
    webOrigin: new URL(env.url("AUTH_WEB_ORIGIN")).origin,
    cookieDomain: env.optional("AUTH_COOKIE_DOMAIN"),
    refreshTtlSeconds: env.int("AUTH_REFRESH_TTL_SECONDS", REFRESH_TTL_SECONDS),
    resetTtlSeconds: env.int("AUTH_RESET_TTL_SECONDS", RESET_TTL_SECONDS),
    inviteTtlSeconds: env.int("AUTH_INVITE_TTL_SECONDS", INVITE_TTL_SECONDS),
    loginAttempts: env.int("AUTH_LOGIN_ATTEMPTS", LOGIN_ATTEMPTS),
    resetAttempts: env.int("AUTH_RESET_ATTEMPTS", RESET_ATTEMPTS),
    attemptWindowMs: env.duration("AUTH_ATTEMPT_WINDOW", 900_000),
})
