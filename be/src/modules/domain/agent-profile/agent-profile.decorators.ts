import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AssignmentThreads } from "./agent-profile.port"

/** Token of the work threads port. */
export const AGENT_PROFILE_THREADS: unique symbol = Symbol("domain.agent-profile.threads")

/** Injects the work threads port. Parameter type: AssignmentThreads. */
export const InjectAssignmentThreads = (): TypedParameterDecorator<AssignmentThreads> =>
    injector<AssignmentThreads>(AGENT_PROFILE_THREADS)
