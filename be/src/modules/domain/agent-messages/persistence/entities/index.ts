import { AgentMessageEntity } from "./agent-message.entity"

export { AgentMessageEntity }

/** Every entity the agent-messages capability owns, collected by the database connection. */
export const agentMessagesEntities: readonly [typeof AgentMessageEntity] = [AgentMessageEntity] as const
