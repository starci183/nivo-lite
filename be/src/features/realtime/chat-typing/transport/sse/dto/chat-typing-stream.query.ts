import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

/** The target of one typing stream: a department room, an agent/customer conversation, or neither for the general Office. */
export class ChatTypingStreamQuery {
    /** A department room key, mutually exclusive with conversationId. */
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null

    /** A conversation id of the selected workspace. */
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    conversationId: string | null = null
}
