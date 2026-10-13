import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The token of an invitation link. */
export class InviteTokenInput {
    /** The token inside the invitation link. */
    @Field()
    @IsString()
    @MinLength(16)
    @MaxLength(200)
    token!: string
}
