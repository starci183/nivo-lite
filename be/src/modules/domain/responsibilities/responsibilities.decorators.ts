import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LeadDesk } from "./responsibilities.ports"

/** Token of the lead desk port; the leads capability binds it. */
export const RESPONSIBILITY_LEAD_DESK: unique symbol = Symbol("domain.responsibilities.lead-desk")

/** Injects the lead desk. Parameter type: LeadDesk. */
export const InjectLeadDesk = (): TypedParameterDecorator<LeadDesk> => injector<LeadDesk>(RESPONSIBILITY_LEAD_DESK)
