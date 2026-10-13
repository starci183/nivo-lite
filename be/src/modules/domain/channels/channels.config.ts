import type { EnvSource } from "@modules/platform/config"
import type { ChannelsOptions } from "./channels.options"

/** Reads the channels options: the site origin is optional and trimmed of a trailing slash. */
export const parseChannelsConfig = (env: EnvSource): ChannelsOptions => ({
    siteUrl: env.optional("SITE_URL")?.replace(/\/$/u, "") ?? null,
})
