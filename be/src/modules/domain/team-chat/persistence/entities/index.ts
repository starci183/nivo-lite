import { ChatRoomMemberEntity } from "./chat-room-member.entity"
import { ChatRoomMessageEntity } from "./chat-room-message.entity"
import { ChatRoomPinEntity } from "./chat-room-pin.entity"
import { ChatRoomEntity } from "./chat-room.entity"

export { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity }

/** The entities the team chat capability owns, for the app's connection. */
export const teamChatEntities: readonly [
    typeof ChatRoomEntity,
    typeof ChatRoomMemberEntity,
    typeof ChatRoomMessageEntity,
    typeof ChatRoomPinEntity,
] = [ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity] as const
