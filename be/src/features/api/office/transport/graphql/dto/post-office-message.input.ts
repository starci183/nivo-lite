import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** Posts a line in the Office thread as the caller. */
export class PostOfficeMessageInput {
    /** The text of the line. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string

    /** The Hub room; absent or null is the general Office room. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null
}
