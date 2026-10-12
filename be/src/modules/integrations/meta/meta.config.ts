import type { EnvSource } from "@modules/platform/config"
import type { MetaApp, MetaOptions } from "./meta.options"

const readApp = (env: EnvSource): MetaApp | null =>
    env.has("META_APP_ID") && env.has("META_APP_SECRET")
        ? { appId: env.string("META_APP_ID").trim(), appSecret: env.secret("META_APP_SECRET") }
        : null

/** Reads the meta options: the app is optional as a group (absent means unavailable), the channel token key is required. */
export const parseMetaConfig = (env: EnvSource): MetaOptions => ({
    app: readApp(env),
    webhookVerifyToken: env.has("META_WEBHOOK_VERIFY_TOKEN") ? env.secret("META_WEBHOOK_VERIFY_TOKEN") : undefined,
    loginConfigId: env.optional("META_LOGIN_CONFIG_ID"),
    graphVersion: env.optional("META_GRAPH_VERSION"),
    siteUrl: env.optional("PUBLIC_SITE_URL"),
    channelTokenKey: env.secret("CHANNEL_TOKEN_KEY"),
    sendPerMinute: env.int("META_SEND_PER_MINUTE", 60),
    timeoutMs: env.duration("META_TIMEOUT", 15_000),
})
