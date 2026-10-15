import type { Secret } from "@modules/platform/config"
import type { TelegramUserErrors } from "./telegram-user.contracts"

/** The app credentials of Telegram (my.telegram.org) that a personal account logs in through. */
export interface TelegramUserApp {
    /** The numeric app id. */
    readonly apiId: number
    /** The app hash. */
    readonly apiHash: Secret
}

/** Options of the personal Telegram integration. */
export interface TelegramUserOptions {
    /** The Telegram app credentials, or null when the deployment has none (the personal Telegram connector is then unavailable). */
    readonly app: TelegramUserApp | null
    /** The error family supplied by the app composition root. */
    readonly errors: TelegramUserErrors
}
