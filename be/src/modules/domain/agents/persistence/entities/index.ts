import { AgentEntity } from "./agent.entity"

export { AgentEntity }

/** Every entity the agents capability owns, collected by the database connection. */
export const agentsEntities = [AgentEntity] as const
