import type { EnvSource } from "@modules/platform/config"
import type { GoogleOAuthClient, GoogleOptions } from "./google.options"

const readClient = (env: EnvSource): GoogleOAuthClient | null => {
    const clientId = env.optional("GOOGLE_OAUTH_CLIENT_ID") ?? env.optional("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID")
    const secretKey = env.has("GOOGLE_OAUTH_CLIENT_SECRET")
        ? "GOOGLE_OAUTH_CLIENT_SECRET"
        : "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET"
    if (clientId === undefined || !env.has(secretKey)) return null
    return { clientId, clientSecret: env.secret(secretKey) }
}

/** Reads the google options: the OAuth client is optional (absent means unavailable), the channel token key is required. */
export const parseGoogleConfig = (env: EnvSource): GoogleOptions => ({
    client: readClient(env),
    oauthBase: env.optional("GOOGLE_OAUTH_BASE"),
    sheetsBase: env.optional("GOOGLE_SHEETS_BASE"),
    siteUrl: env.optional("PUBLIC_API_URL") ?? env.optional("PUBLIC_SITE_URL"),
    channelTokenKey: env.secret("CHANNEL_TOKEN_KEY"),
    timeoutMs: env.duration("GOOGLE_TIMEOUT", 10_000),
})
