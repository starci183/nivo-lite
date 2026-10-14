import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TelegramUserClient } from "./telegram-user.client"
import type { TelegramUserOptions } from "./telegram-user.options"

/** Token of the personal Telegram client. */
export const TELEGRAM_USER: unique symbol = Symbol("integrations.data-sources.telegram-user")

/** Token of the personal Telegram options, exported so a spec can provide it. */
export const TELEGRAM_USER_OPTIONS: unique symbol = Symbol("integrations.telegram-user.options")

/** Injects the personal Telegram client. Parameter type: TelegramUserClient. */
export const InjectTelegramUser = (): TypedParameterDecorator<TelegramUserClient> =>
    injector<TelegramUserClient>(TELEGRAM_USER)

/** Injects the personal Telegram options. Parameter type: TelegramUserOptions. */
export const InjectTelegramUserOptions = (): TypedParameterDecorator<TelegramUserOptions> =>
    injector<TelegramUserOptions>(TELEGRAM_USER_OPTIONS)
