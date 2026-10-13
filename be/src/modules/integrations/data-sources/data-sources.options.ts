import type { Secret } from "@modules/platform/config"

/** The app credentials of Telegram (my.telegram.org) that a personal account logs in through. */
export interface TelegramUserOptions {
    /** The numeric app id. */
    readonly apiId: number
    /** The app hash. */
    readonly apiHash: Secret
}

/** Options of the data-sources integration. */
export interface DataSourcesOptions {
    /** True on a development site: a database, mailbox or API on a private address may be reached. */
    readonly allowPrivateHosts: boolean
    /** The Telegram app credentials, or null when the deployment has none (the personal Telegram connector is then unavailable). */
    readonly telegramUser: TelegramUserOptions | null
}
