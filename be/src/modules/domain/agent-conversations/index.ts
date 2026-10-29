// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { AgentConversationsReadService } from "./agent-conversations-read.service"
export type { CustomerChatRef, TestChatRef } from "./agent-conversations-read.contracts"
export { AgentConversationsModule } from "./agent-conversations.module"
export { AgentConversationsService } from "./agent-conversations.service"
export {
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AgentConversationsError,
    AgentConversationsErrorCode,
} from "./errors/agent-conversations.error"
export { AGENT_CONVERSATIONS_MESSAGES } from "./messages/agent-conversations.messages"
export type { ConversationRef, ConversationTarget, TurnConversation } from "./agent-conversations.contracts"
export type { ChatConversation } from "./agent-conversations.contracts"
export { AgentConversationEntity, agentConversationsEntities } from "./persistence/entities"
export type { CustomerLeadConversation } from "./agent-conversations.contracts"
