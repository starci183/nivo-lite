import type { EnvSource } from "@modules/platform/config"
import type { TelegramOptions } from "./telegram.options"

/** The public Bot API origin; a fake of the test world overrides it with TELEGRAM_API_BASE. */
const DEFAULT_API_BASE = "https://api.telegram.org"

/** Reads the Telegram options: the bot tokens are per connection and stored encrypted, so only tunables live in the environment. */
export const parseTelegramConfig = (env: EnvSource): TelegramOptions => ({
    apiBase: (env.optional("TELEGRAM_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("TELEGRAM_TIMEOUT", 10_000),
})
