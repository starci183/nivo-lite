import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TelegramReceiptProcessor } from "./telegram-inbox.port"

/** The domain consumer of committed Telegram receipt references. */
export const TELEGRAM_RECEIPT_PROCESSOR: unique symbol = Symbol("domain.telegram-inbox.receipt-processor")

/** Injects the receipt processor called after the worker records its live fence. Parameter type: TelegramReceiptProcessor. */
export const InjectTelegramReceiptProcessor = (): TypedParameterDecorator<TelegramReceiptProcessor> =>
    injector<TelegramReceiptProcessor>(TELEGRAM_RECEIPT_PROCESSOR)
