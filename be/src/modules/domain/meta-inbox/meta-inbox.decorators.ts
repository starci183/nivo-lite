import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MetaEventTaker } from "./meta-inbox.port"

/** Token of the Meta event taker port. */
export const META_EVENT_TAKER: unique symbol = Symbol("domain.meta-inbox.meta-event-taker")

/** Injects the Meta event taker. Parameter type: MetaEventTaker. */
export const InjectMetaEventTaker = (): TypedParameterDecorator<MetaEventTaker> =>
    injector<MetaEventTaker>(META_EVENT_TAKER)
