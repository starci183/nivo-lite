import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, MaxLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** Names one Hub room. */
export class OfficeRoomKeyInput {
    /** The room key; absent or null is the general Office room. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null
}
