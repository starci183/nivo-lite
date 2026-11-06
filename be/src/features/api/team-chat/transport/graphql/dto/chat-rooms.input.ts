import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { ChatRoomKind } from "./chat-room-kind.type"

@InputType()
/** Narrows the room list. */
export class ChatRoomsInput {
    /** Only this kind; omit for both. */
    @Field(() => ChatRoomKind, { nullable: true })
    @IsOptional()
    @IsIn(["direct", "group"])
    kind: string | null = null

    /** Only the rooms the viewer shares with this agent or person, by id (kind direct and this id: the viewer direct room with them, or nothing). */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("all")
    @MaxLength(36)
    member: string | null = null
}
