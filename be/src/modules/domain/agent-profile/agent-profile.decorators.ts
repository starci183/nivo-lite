import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AssignmentThreads, AssignmentWork } from "./agent-profile.port"

/** Token of the work threads port. */
export const AGENT_PROFILE_THREADS: unique symbol = Symbol("domain.agent-profile.threads")

/** Injects the work threads port. Parameter type: AssignmentThreads. */
export const InjectAssignmentThreads = (): TypedParameterDecorator<AssignmentThreads> =>
    injector<AssignmentThreads>(AGENT_PROFILE_THREADS)

/** Token of the agents' runtime port. */
export const AGENT_PROFILE_WORK: unique symbol = Symbol("domain.agent-profile.work")

/** Injects the agents' runtime port. Parameter type: AssignmentWork. */
export const InjectAssignmentWork = (): TypedParameterDecorator<AssignmentWork> =>
    injector<AssignmentWork>(AGENT_PROFILE_WORK)
