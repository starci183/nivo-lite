import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LeadTurnReader } from "./lead-flows.port"

/** Token of the turn reader port. */
export const LEAD_TURN_READER: unique symbol = Symbol("domain.lead-flows.lead-turn-reader")

/** Injects the turn reader. Parameter type: LeadTurnReader. */
export const InjectLeadTurnReader = (): TypedParameterDecorator<LeadTurnReader> =>
    injector<LeadTurnReader>(LEAD_TURN_READER)
