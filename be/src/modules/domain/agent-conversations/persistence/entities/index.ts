import { AgentConversationEntity } from "./agent-conversation.entity"

export { AgentConversationEntity }

/** Every entity the agent-conversations capability owns, collected by the database connection. */
export const agentConversationsEntities = [AgentConversationEntity] as const
