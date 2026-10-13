import { isPublicSite } from "@modules/integrations/mail"
import type { EnvSource } from "@modules/platform/config"
import type { DataSourcesOptions } from "./data-sources.options"

/** Reads the data-sources options: a private target is allowed on a development site or by an explicit flag; Telegram is all-or-nothing. */
export const parseDataSourcesConfig = (env: EnvSource): DataSourcesOptions => ({
    allowPrivateHosts: !isPublicSite(env.optional("SITE_URL")) || env.bool("DATA_ALLOW_PRIVATE_HOSTS", false),
    telegramUser: env.anyDeclared(["TELEGRAM_API_ID", "TELEGRAM_API_HASH"])
        ? { apiId: env.int("TELEGRAM_API_ID"), apiHash: env.secret("TELEGRAM_API_HASH") }
        : null,
})
