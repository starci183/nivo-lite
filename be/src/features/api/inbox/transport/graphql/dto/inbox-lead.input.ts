import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The customer to open: a lead id, or the `key:` / `event:` id of a customer that is no lead yet. */
export class InboxLeadInput {
    /** The customer id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    id!: string
}
