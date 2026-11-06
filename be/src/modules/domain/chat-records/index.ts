export { ChatRecordsModule } from "./chat-records.module"
export { ChatConversationsService } from "./chat-conversations.service"
export { ChatMessagesService } from "./chat-messages.service"
export { CHAT_RECORDS_ERROR_KINDS, ChatRecordsError, ChatRecordsErrorCode } from "./errors/chat-records.error"
export { CHAT_RECORDS_MESSAGES } from "./messages/chat-records.messages"
export { CHAT_DELIVERY_UNKNOWN } from "./delivery.policy"
export { chatStampOf } from "./message-stamp.policy"
export type {
    ChatConversationRef,
    ChatConversationTarget,
    ChatCustomerLine,
    ChatFollower,
    HumanAuthor,
    ChatHumanConversation,
    ChatMessageStamp,
    Met,
    ChatStoredReply,
    ChatTranscriptLine,
    ChatTurnConversation,
} from "./chat-records.contracts"
