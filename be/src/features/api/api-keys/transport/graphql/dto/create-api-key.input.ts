import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that create an API key. */
export class CreateApiKeyInput {
    /** The name of the key (trimmed to 60 characters, at least 2). */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name!: string
}
