import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MetaEventTaker, MetaReceiptProcessor } from "./meta-inbox.port"

/** Token of the Meta event taker port. */
export const META_EVENT_TAKER: unique symbol = Symbol("domain.meta-inbox.meta-event-taker")

/** Injects the Meta event taker. Parameter type: MetaEventTaker. */
export const InjectMetaEventTaker = (): TypedParameterDecorator<MetaEventTaker> =>
    injector<MetaEventTaker>(META_EVENT_TAKER)

/** The domain processor of committed Meta receipt references. */
export const META_RECEIPT_PROCESSOR: unique symbol = Symbol("domain.meta-inbox.meta-receipt-processor")

/** Injects the committed receipt processor port. Parameter type: MetaReceiptProcessor. */
export const InjectMetaReceiptProcessor = (): TypedParameterDecorator<MetaReceiptProcessor> =>
    injector<MetaReceiptProcessor>(META_RECEIPT_PROCESSOR)
