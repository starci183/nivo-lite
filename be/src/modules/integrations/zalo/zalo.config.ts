import type { EnvSource } from "@modules/platform/config"
import type { ZaloOptions } from "./zalo.options"

/** The public Zalo hosts; a fake of the test world overrides them with ZALO_OAUTH_BASE, ZALO_API_BASE and ZALO_BUSINESS_BASE. */
const DEFAULT_OAUTH_BASE = "https://oauth.zaloapp.com"
const DEFAULT_API_BASE = "https://openapi.zalo.me"
const DEFAULT_BUSINESS_BASE = "https://business.openapi.zalo.me"

const withoutTrailingSlash = (origin: string): string => origin.replace(/\/$/u, "")

/** Reads the Zalo options: the app credentials are per connection and stored encrypted, so only hosts and a timeout live in the environment. */
export const parseZaloConfig = (env: EnvSource): ZaloOptions => ({
    oauthBase: withoutTrailingSlash(env.optional("ZALO_OAUTH_BASE") ?? DEFAULT_OAUTH_BASE),
    apiBase: withoutTrailingSlash(env.optional("ZALO_API_BASE") ?? DEFAULT_API_BASE),
    businessBase: withoutTrailingSlash(env.optional("ZALO_BUSINESS_BASE") ?? DEFAULT_BUSINESS_BASE),
    timeoutMs: env.duration("ZALO_TIMEOUT", 10_000),
})
