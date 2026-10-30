import type { EnvSource } from "@modules/platform/config"
import type { ChannelsConfig } from "./channels.options"

/** Reads the channels options: the site origin is required and trimmed of a trailing slash. */
export const parseChannelsConfig = (env: EnvSource): ChannelsConfig => ({
    siteUrl: env.url("SITE_URL").replace(/\/$/u, ""),
})
