import { AgentAccessLogEntity } from "./agent-access-log.entity"

export { AgentAccessLogEntity }

/** Every entity the agent-access-log capability owns, collected by the database connection. */
export const agentAccessLogEntities = [AgentAccessLogEntity] as const
