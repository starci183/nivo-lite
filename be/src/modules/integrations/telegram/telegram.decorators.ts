import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TelegramClient } from "./telegram.client"
import type { TelegramOptions } from "./telegram.options"

/** Token of the Telegram client. */
export const TELEGRAM: unique symbol = Symbol("integrations.telegram")

/** Token of the options of the Telegram integration, exported so a spec can provide it. */
export const TELEGRAM_OPTIONS: unique symbol = Symbol("integrations.telegram.options")

/** Injects the options of the Telegram integration. Parameter type: TelegramOptions. */
export const InjectTelegramOptions = (): TypedParameterDecorator<TelegramOptions> =>
    injector<TelegramOptions>(TELEGRAM_OPTIONS)

/** Injects the Telegram client. Parameter type: TelegramClient. */
export const InjectTelegram = (): TypedParameterDecorator<TelegramClient> => injector<TelegramClient>(TELEGRAM)
