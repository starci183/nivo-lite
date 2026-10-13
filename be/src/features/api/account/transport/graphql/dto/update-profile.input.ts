import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The display name the caller wants to carry. */
export class UpdateProfileInput {
    /** The display name, 2 to 120 characters. */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name!: string
}
