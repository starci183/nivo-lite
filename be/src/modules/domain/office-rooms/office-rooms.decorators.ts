import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { RoomsAgents } from "./office-rooms.port"

/** Token of the agents port; the agents capability binds it. */
export const OFFICE_ROOMS_AGENTS: unique symbol = Symbol("domain.office-rooms.agents")

/** Injects the agents port. Parameter type: RoomsAgents. */
export const InjectRoomsAgents = (): TypedParameterDecorator<RoomsAgents> => injector<RoomsAgents>(OFFICE_ROOMS_AGENTS)
