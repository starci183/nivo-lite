import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** One room or agent/customer conversation; both absent means the general Office. */
export class ChatTypingTargetInput {
    /** A department room key, mutually exclusive with conversationId. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null

    /** An existing conversation of the selected workspace. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    conversationId: string | null = null
}
