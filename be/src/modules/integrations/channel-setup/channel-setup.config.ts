import type { EnvSource } from "@modules/platform/config"
import type { ChannelSetupOptions } from "./channel-setup.options"

/** Reads the channel-setup options: every key is optional, the timeout is a tunable with a literal default. */
export const parseChannelSetupConfig = (env: EnvSource): ChannelSetupOptions => ({
    zaloOauthBase: env.optional("ZALO_OAUTH_BASE"),
    siteUrl: env.optional("PUBLIC_SITE_URL"),
    timeoutMs: env.duration("CHANNEL_SETUP_TIMEOUT", 10_000),
})
