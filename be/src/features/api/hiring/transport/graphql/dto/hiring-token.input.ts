import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The link token of a candidate page. */
export class HiringTokenInput {
    /** The link token. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    token!: string
}
