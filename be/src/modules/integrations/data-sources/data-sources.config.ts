import type { EnvSource } from "@modules/platform/config"
import type { DataSourcesOptions } from "./data-sources.options"

/** True for a site that is not a public https origin: a missing, plain-http, local or unparsable address means a development site. */
const isDevelopmentSite = (siteUrl: string | undefined): boolean => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return true
    const { protocol, hostname } = new URL(siteUrl)
    return (
        protocol !== "https:" || hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")
    )
}

/** Reads the data-sources options: a private target is allowed on a development site or by an explicit flag. */
export const parseDataSourcesConfig = (env: EnvSource): DataSourcesOptions => ({
    allowPrivateHosts: isDevelopmentSite(env.optional("SITE_URL")) || env.bool("DATA_ALLOW_PRIVATE_HOSTS", false),
})
