// The directory and the ports lead: other capabilities import this barrel while it loads (import cycles) and bind the ports.
export { OFFICE_ROOMS_AGENTS, OFFICE_ROOMS_LEADS, OFFICE_ROOMS_TEST_CHATS } from "./office-rooms.decorators"
export type {
    RoomAgentSeat,
    RoomsAgentChats,
    RoomsAgentMark,
    RoomsAgents,
    RoomsChatLine,
    RoomsLeads,
    RoomsReader,
    RoomsTestChats,
} from "./office-rooms.port"
export { OfficeRoomDirectoryModule } from "./office-room-directory.module"
export { OfficeRoomDirectoryService } from "./office-room-directory.service"
export { OFFICE_ROOMS_ERROR_KINDS } from "./errors/office-rooms.error"
export { OFFICE_ROOMS_MESSAGES } from "./messages/office-rooms.messages"
export { OfficeRoomsModule } from "./office-rooms.module"
export { OfficeRoomsService } from "./office-rooms.service"
export { OfficeReadMarkersService } from "./office-read-markers.service"
export { OfficeRoomReadsService } from "./office-room-reads.service"
export { OfficeRoomMembersService } from "./office-room-members.service"
export type { RoomLabel, UserSeatRoom } from "./office-room-directory.contracts"
export type { ConversationKind, ConversationUnreadListView, RoomView } from "./office-rooms.contracts"
export { OfficeRoomEntity, OfficeRoomMemberEntity, officeRoomsEntities } from "./persistence/entities"
