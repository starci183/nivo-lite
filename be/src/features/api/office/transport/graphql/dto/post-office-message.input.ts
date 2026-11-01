import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"

@InputType()
/** The file uploaded for a line. */
export class PostedOfficeFileInput {
    /** The object path the upload address answered. */
    @Field()
    @IsString()
    @MaxLength(255)
    path!: string

    /** The name of the file. */
    @Field()
    @IsString()
    @MaxLength(255)
    name!: string
}

@InputType()
/** Posts a line in the Office thread as the caller. */
export class PostOfficeMessageInput {
    /** The text of the line. */
    @Field()
    @IsString()
    @MaxLength(4000)
    body!: string

    /** The Hub room; absent or null is the general Office room. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null

    /** The file sent with the line. */
    @Field(() => PostedOfficeFileInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => PostedOfficeFileInput)
    file: PostedOfficeFileInput | null = null
}
