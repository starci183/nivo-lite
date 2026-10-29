import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RoomsAgents, RoomsLeads, RoomsTestChats } from "./office-rooms.port"

/** Token of the agents port; the agents capability binds it. */
export const OFFICE_ROOMS_AGENTS: unique symbol = Symbol("domain.office-rooms.agents")

/** Token of the leads port; the leads capability binds it. */
export const OFFICE_ROOMS_LEADS: unique symbol = Symbol("domain.office-rooms.leads")

/** Token of the test chats port; the agent messages capability binds it. */
export const OFFICE_ROOMS_TEST_CHATS: unique symbol = Symbol("domain.office-rooms.test-chats")

/** Injects the agents port. Parameter type: RoomsAgents. */
export const InjectRoomsAgents = (): TypedParameterDecorator<RoomsAgents> => injector<RoomsAgents>(OFFICE_ROOMS_AGENTS)

/** Injects the leads port. Parameter type: RoomsLeads. */
export const InjectRoomsLeads = (): TypedParameterDecorator<RoomsLeads> => injector<RoomsLeads>(OFFICE_ROOMS_LEADS)

/** Injects the test chats port. Parameter type: RoomsTestChats. */
export const InjectRoomsTestChats = (): TypedParameterDecorator<RoomsTestChats> =>
    injector<RoomsTestChats>(OFFICE_ROOMS_TEST_CHATS)
