import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** One room; absent means the general Office. */
export class ChatTypingTargetInput {
    /** A department room key. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null
}
