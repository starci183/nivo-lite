import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** Posts a line in the Office thread as the caller. */
export class PostOfficeMessageInput {
    /** The text of the line. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string
}
