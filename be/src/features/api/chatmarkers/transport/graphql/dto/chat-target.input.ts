import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** Names one chat; leave the room null for the general Office room. */
export class ChatTargetInput {
    /** A department room; null is the general Office room. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null
}
