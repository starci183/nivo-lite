import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ChatMemberRefInput } from "./chat-member-ref.input"

@InputType()
/** Adds a member to a group or removes one (a member may remove themselves). */
export class ChatRoomMemberInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** The member. */
    @Field(() => ChatMemberRefInput)
    @ValidateNested()
    @Type(() => ChatMemberRefInput)
    member!: ChatMemberRefInput
}
