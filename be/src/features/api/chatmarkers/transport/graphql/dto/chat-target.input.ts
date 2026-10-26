import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** Names one chat; leave both fields null for the general Office room. */
export class ChatTargetInput {
    /** A department room; must be null when conversationId is supplied. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null

    /** An agent test or customer conversation in the selected workspace. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("all")
    @MaxLength(36)
    conversationId: string | null = null
}
