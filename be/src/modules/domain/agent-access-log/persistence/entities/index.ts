import { AgentAccessLogEntity } from "./agent-access-log.entity"

export { AgentAccessLogEntity }

/** Every entity the agent-access-log capability owns, collected by the database connection. */
export const agentAccessLogEntities: readonly [typeof AgentAccessLogEntity] = [AgentAccessLogEntity] as const
