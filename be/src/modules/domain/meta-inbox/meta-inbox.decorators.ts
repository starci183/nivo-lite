import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MetaReceiptProcessor } from "./meta-inbox.port"

/** The domain processor of committed Meta receipt references. */
export const META_RECEIPT_PROCESSOR: unique symbol = Symbol("domain.meta-inbox.meta-receipt-processor")

/** Injects the committed receipt processor port. Parameter type: MetaReceiptProcessor. */
export const InjectMetaReceiptProcessor = (): TypedParameterDecorator<MetaReceiptProcessor> =>
    injector<MetaReceiptProcessor>(META_RECEIPT_PROCESSOR)
