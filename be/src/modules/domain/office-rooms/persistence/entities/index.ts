import { OfficeRoomEntity } from "./office-room.entity"
import { OfficeRoomMemberEntity } from "./office-room-member.entity"
import { OfficeRoomPinEntity } from "./office-room-pin.entity"
import { OfficeRoomReadEntity } from "./office-room-read.entity"

export { OfficeRoomEntity, OfficeRoomMemberEntity, OfficeRoomPinEntity, OfficeRoomReadEntity }

/** The entities of the office-rooms capability, registered on the primary connection. */
export const officeRoomsEntities: readonly [
    typeof OfficeRoomEntity,
    typeof OfficeRoomMemberEntity,
    typeof OfficeRoomPinEntity,
    typeof OfficeRoomReadEntity,
] = [OfficeRoomEntity, OfficeRoomMemberEntity, OfficeRoomPinEntity, OfficeRoomReadEntity] as const
