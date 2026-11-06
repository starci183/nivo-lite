import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RoomsAgents, RoomsTestChats } from "./office-rooms.port"

/** Token of the agents port; the agents capability binds it. */
export const OFFICE_ROOMS_AGENTS: unique symbol = Symbol("domain.office-rooms.agents")

/** Token of the test chats port; the agent messages capability binds it. */
export const OFFICE_ROOMS_TEST_CHATS: unique symbol = Symbol("domain.office-rooms.test-chats")

/** Injects the agents port. Parameter type: RoomsAgents. */
export const InjectRoomsAgents = (): TypedParameterDecorator<RoomsAgents> => injector<RoomsAgents>(OFFICE_ROOMS_AGENTS)

/** Injects the test chats port. Parameter type: RoomsTestChats. */
export const InjectRoomsTestChats = (): TypedParameterDecorator<RoomsTestChats> =>
    injector<RoomsTestChats>(OFFICE_ROOMS_TEST_CHATS)
