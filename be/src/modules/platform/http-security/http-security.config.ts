import type { EnvSource } from "@modules/platform/config"
import { isAllowedOrigin } from "./allowed-origin.policy"
import type { HttpSecurityOptions, WebhookProviderOptions } from "./http-security.options"

/** Reads one webhook provider's required signing secret and bounded replay window. */
export const parseWebhookProviderConfig = (env: EnvSource, prefix: string): WebhookProviderOptions => ({
    secret: env.secret(`${prefix}_WEBHOOK_SECRET`),
    toleranceMs: env.duration(`${prefix}_WEBHOOK_TOLERANCE`, 300_000),
})

/** Reads canonical origin allowlist entries, zero to two trusted proxy hops (default one), and the rate-limit tunables. */
export const parseHttpSecurityConfig = (env: EnvSource): HttpSecurityOptions => {
    const rawOrigins = env.string("HTTP_SECURITY_ALLOWED_ORIGINS")
    const allowedOrigins = rawOrigins.split(",").map((origin) => origin.trim())
    env.enum("HTTP_SECURITY_ALLOWED_ORIGINS", allowedOrigins.every(isAllowedOrigin) ? [rawOrigins] : [])
    return {
        trustedProxyHops: env.has("HTTP_SECURITY_TRUSTED_PROXY_HOPS")
            ? Number(env.enum("HTTP_SECURITY_TRUSTED_PROXY_HOPS", ["0", "1", "2"]))
            : 1,
        allowedOrigins,
        rateLimit: {
            windowMs: env.duration("HTTP_SECURITY_RATE_WINDOW", 60_000),
            defaultLimit: env.int("HTTP_SECURITY_RATE_DEFAULT_LIMIT", 600),
            strictLimit: env.int("HTTP_SECURITY_RATE_STRICT_LIMIT", 30),
        },
        webhooks: {},
    }
}
