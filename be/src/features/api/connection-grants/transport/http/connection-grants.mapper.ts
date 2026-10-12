import type { AgentGrantWish, ConnectionGrantWish } from "@modules/domain/connection-grants"
import type { AgentGrantRequest, ConnectionGrantRequest } from "./dto/connection-grants.request"

/** Maps the wished agents of the body; a level is carried only when the caller gave one. */
export const toAgentWishes = (agents: ReadonlyArray<AgentGrantRequest>): ReadonlyArray<AgentGrantWish> =>
    agents.map((agent) => ({ agentId: agent.agentId, ...(agent.access === undefined ? {} : { access: agent.access }) }))

/** Maps the wished connections of the body; a level is carried only when the caller gave one. */
export const toConnectionWishes = (
    connections: ReadonlyArray<ConnectionGrantRequest>,
): ReadonlyArray<ConnectionGrantWish> =>
    connections.map((connection) => ({
        connectionId: connection.connectionId,
        ...(connection.access === undefined ? {} : { access: connection.access }),
    }))
