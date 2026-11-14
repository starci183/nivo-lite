import type { EnvSource } from "@modules/platform/config"
import type { TiktokAppClient, TiktokOptions } from "./tiktok.options"

/** The API origin of the Content Posting API documentation (`https://open.tiktokapis.com/v2/...`). */
const DEFAULT_API_BASE = "https://open.tiktokapis.com"

const readClient = (env: EnvSource): TiktokAppClient | null => {
    const clientKey = env.optional("TIKTOK_CLIENT_KEY")
    if (clientKey === undefined || !env.has("TIKTOK_CLIENT_SECRET")) return null
    return { clientKey, clientSecret: env.secret("TIKTOK_CLIENT_SECRET") }
}

/** Reads the TikTok options: the app client is optional, the rest are tunables. */
export const parseTiktokConfig = (env: EnvSource): TiktokOptions => ({
    apiBase: (env.optional("TIKTOK_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    client: readClient(env),
    timeoutMs: env.duration("TIKTOK_API_TIMEOUT", 30_000),
    uploadTimeoutMs: env.duration("TIKTOK_UPLOAD_TIMEOUT", 300_000),
})
