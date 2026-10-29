import { AgentConnectionEntity } from "./agent-connection.entity"

export { AgentConnectionEntity }

/** Every entity the agent-connections capability owns, collected by the database connection. */
export const agentConnectionsEntities = [AgentConnectionEntity] as const
