export { teamChatEntities } from "./persistence/entities"
export { TEAM_CHAT_ERROR_KINDS, TeamChatErrorCode } from "./errors/team-chat.error"
export { TEAM_CHAT_MESSAGES } from "./messages/team-chat.messages"
export { TeamChatModule } from "./team-chat.module"
export { TeamChatService } from "./team-chat.service"
export { BODY_MAX, FILES_MAX, MENTIONS_MAX, PAGE_DEFAULT, PAGE_MAX } from "./team-chat.contracts"
export type {
    MemberKind,
    MemberRef,
    MessagePage,
    MessageView,
    RoomMemberView,
    RoomUnread,
    RoomView,
    SendInput,
    TeamChatResult,
    UnreadView,
} from "./team-chat.contracts"
