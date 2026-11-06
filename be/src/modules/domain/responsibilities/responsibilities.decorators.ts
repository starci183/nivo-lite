import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LeadDesk, ResponsibilityAgents } from "./responsibilities.port"

/** Token of the lead desk port; the leads capability binds it. */
export const RESPONSIBILITY_LEAD_DESK: unique symbol = Symbol("domain.responsibilities.lead-desk")

/** Injects the lead desk. Parameter type: LeadDesk. */
export const InjectLeadDesk = (): TypedParameterDecorator<LeadDesk> => injector<LeadDesk>(RESPONSIBILITY_LEAD_DESK)

/** Token of the agents port; the app root binds it. */
export const RESPONSIBILITY_AGENTS: unique symbol = Symbol("domain.responsibilities.agents")

/** Injects the agents port. Parameter type: ResponsibilityAgents. */
export const InjectResponsibilityAgents = (): TypedParameterDecorator<ResponsibilityAgents> =>
    injector<ResponsibilityAgents>(RESPONSIBILITY_AGENTS)
