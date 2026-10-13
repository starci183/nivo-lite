import type { EnvSource } from "@modules/platform/config"
import type { DataSourcesOptions } from "./data-sources.options"

/** Reads the data-sources options: only a flag; a private target is allowed on a development site by the caller composing the app. */
export const parseDataSourcesConfig = (env: EnvSource): DataSourcesOptions => ({
    allowPrivateHosts: env.bool("DATA_ALLOW_PRIVATE_HOSTS", false),
})
