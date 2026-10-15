import type { EnvSource } from "@modules/platform/config"
import type { TelegramUserOptions } from "./telegram-user.options"

/** Reads the personal Telegram app credentials, requiring both keys when either is declared. */
export const parseTelegramUserConfig = (env: EnvSource): Omit<TelegramUserOptions, "errors"> => ({
    app: env.anyDeclared(["TELEGRAM_API_ID", "TELEGRAM_API_HASH"])
        ? { apiId: env.int("TELEGRAM_API_ID"), apiHash: env.secret("TELEGRAM_API_HASH") }
        : null,
})
