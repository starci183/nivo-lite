// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { AgentConversationsAutomationReadService } from "./agent-conversations-automation-read.service"
export { AgentConversationsReadService } from "./agent-conversations-read.service"
export type { ConnectionConversation, CustomerConversationRow } from "./agent-conversations-read.contracts"
export { AgentConversationsModule } from "./agent-conversations.module"
export { AgentConversationReadService } from "./agent-conversation-reads.service"
export { AgentConversationsService } from "./agent-conversations.service"
export { ConversationHandoverService } from "./conversation-handover.service"
export {
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AgentConversationsError,
    AgentConversationsErrorCode,
} from "./errors/agent-conversations.error"
export { AGENT_CONVERSATIONS_MESSAGES } from "./messages/agent-conversations.messages"
export type { ConversationRef, ConversationTarget, TurnConversation } from "./agent-conversations.contracts"
export type { ChatConversation, CustomerChat } from "./agent-conversations.contracts"
export { agentConversationsEntities } from "./persistence/entities"
