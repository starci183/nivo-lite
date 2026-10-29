import type { EnvSource } from "@modules/platform/config"
import type { PassportGoogleOptions, PassportOptions } from "./passport.options"

const ACCESS_TTL_SECONDS = 900
const BCRYPT_COST = 10

/** PEM text may travel through a one-line environment value with escaped line breaks. */
const pemOf = (value: string): string => value.replaceAll(String.raw`\n`, "\n")

const readGoogle = (env: EnvSource): PassportGoogleOptions | null => {
    if (!env.has("GOOGLE_OAUTH_CLIENT_ID") || !env.has("GOOGLE_OAUTH_CLIENT_SECRET")) return null
    return {
        clientId: env.string("GOOGLE_OAUTH_CLIENT_ID"),
        clientSecret: env.secret("GOOGLE_OAUTH_CLIENT_SECRET"),
        callbackUrl: env.url("AUTH_GOOGLE_CALLBACK_URL"),
    }
}

/** Reads the passport options: the signing key pair is required, the Google client is optional. The authenticator token is the app's. */
export const parsePassportConfig = (env: EnvSource): Omit<PassportOptions, "authenticator"> => ({
    privateKey: env.secret("AUTH_JWT_PRIVATE_KEY"),
    publicKey: pemOf(env.string("AUTH_JWT_PUBLIC_KEY")),
    keyId: env.optional("AUTH_JWT_KEY_ID"),
    issuer: env.optional("AUTH_JWT_ISSUER") ?? "nivo-lite",
    returnOrigin: new URL(env.url("AUTH_WEB_ORIGIN")).origin,
    audience: "authenticated",
    accessTtlSeconds: env.int("AUTH_ACCESS_TTL_SECONDS", ACCESS_TTL_SECONDS),
    bcryptCost: env.int("AUTH_BCRYPT_COST", BCRYPT_COST),
    google: readGoogle(env),
})
