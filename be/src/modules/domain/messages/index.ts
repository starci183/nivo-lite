// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { MessagesReadService } from "./messages-read.service"
export { MessageCursorsService } from "./message-cursors.service"
export type {
    LineActivity,
    LineReader,
    LineText,
    ThreadLine,
} from "./messages-read.contracts"
export type { OptionalAgentIdentity } from "./office-lines.contracts"
export { AGENT_DIRECTORY, InjectAgentDirectory } from "./office-lines.decorators"
export type { AgentDirectory } from "./office-lines.port"
export { MessagesModule } from "./messages.module"
export type { PostedMessage } from "./messages.contracts"
export { MessagesService } from "./messages.service"
export { TeamChatService } from "./team-chat.service"
export { OfficeLinesService } from "./office-lines.service"
export { OfficeCardsService } from "./office-cards.service"
export { isOfficeRoomKey } from "./office-card.policy"
export { OFFICE_ROOM_KEYS } from "./office-cards.contracts"
export type { OfficeCardPost } from "./office-cards.contracts"
export { MESSAGES_ERROR_KINDS } from "./errors/messages.error"
export { MESSAGES_MESSAGES } from "./messages/messages.messages"
export { messagesEntities } from "./persistence/entities"
