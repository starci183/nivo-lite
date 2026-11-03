import type { EnvSource } from "@modules/platform/config"
import type { PassportOptions } from "./passport.options"

/** The issuer live sessions were signed under, used when `AUTH_JWT_ISSUER` names none. */
export const DEFAULT_ISSUER = "nivo-lite"
const ACCESS_TTL_SECONDS = 900
/** How long a refresh token lives unless `AUTH_REFRESH_TTL_SECONDS` says otherwise, in seconds. */
export const DEFAULT_REFRESH_TTL_SECONDS = 2_592_000
const REFRESH_TTL_SECONDS = DEFAULT_REFRESH_TTL_SECONDS
const BCRYPT_COST = 10
const LOGIN_ATTEMPTS = 10
const RESET_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 900_000

/** The name of the refresh cookie live sessions already carry. */
export const REFRESH_COOKIE_NAME = "nivo_refresh"
/** The name of the cookie that carries one Google round trip. */
export const GOOGLE_STATE_COOKIE_NAME = "nivo_google_state"
/** The refresh cookie is sent on every path: the web app's server reads it on its own pages and forwards it to the api. */
export const REFRESH_COOKIE_PATH = "/"
/** The path older sessions wrote the cookie under; it is cleared so a stale copy never shadows the live one. */
export const REFRESH_COOKIE_LEGACY_PATHS: ReadonlyArray<string> = ["/auth"]

const readGoogle = (env: EnvSource): PassportOptions["google"] => {
    if (!env.has("GOOGLE_OAUTH_CLIENT_ID") || !env.has("GOOGLE_OAUTH_CLIENT_SECRET")) return null
    return {
        clientId: env.string("GOOGLE_OAUTH_CLIENT_ID"),
        clientSecret: env.secret("GOOGLE_OAUTH_CLIENT_SECRET"),
        callbackUrl: env.url("AUTH_GOOGLE_CALLBACK_URL"),
        stateCookie: GOOGLE_STATE_COOKIE_NAME,
    }
}

/** Reads the sign-in settings: the signing key pair is required, the Google client is optional. */
export const parsePassportConfig = (env: EnvSource): PassportOptions => ({
    issuer: env.optional("AUTH_JWT_ISSUER") ?? DEFAULT_ISSUER,
    audience: "authenticated",
    keys: [
        {
            privateKey: env.secret("AUTH_JWT_PRIVATE_KEY"),
            publicKey: env.string("AUTH_JWT_PUBLIC_KEY"),
            keyId: env.optional("AUTH_JWT_KEY_ID"),
        },
    ],
    accessTtlSeconds: env.int("AUTH_ACCESS_TTL_SECONDS", ACCESS_TTL_SECONDS),
    refreshTtlSeconds: env.int("AUTH_REFRESH_TTL_SECONDS", REFRESH_TTL_SECONDS),
    bcryptCost: env.int("AUTH_BCRYPT_COST", BCRYPT_COST),
    returnOrigin: new URL(env.url("AUTH_WEB_ORIGIN")).origin,
    google: readGoogle(env),
    cookie: {
        name: REFRESH_COOKIE_NAME,
        domain: env.optional("AUTH_COOKIE_DOMAIN"),
        domains: env.domains("AUTH_COOKIE_DOMAINS"),
        path: REFRESH_COOKIE_PATH,
        legacyPaths: REFRESH_COOKIE_LEGACY_PATHS,
        sameSite: "lax",
    },
    budget: {
        loginAttempts: env.int("AUTH_LOGIN_ATTEMPTS", LOGIN_ATTEMPTS),
        resetAttempts: env.int("AUTH_RESET_ATTEMPTS", RESET_ATTEMPTS),
        windowMs: env.duration("AUTH_ATTEMPT_WINDOW", ATTEMPT_WINDOW_MS),
    },
})
