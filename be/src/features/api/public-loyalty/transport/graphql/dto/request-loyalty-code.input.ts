import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded phone used to request a code in the customer's chat. */
export class RequestLoyaltyCodeInput {
    /** The published loyalty program slug. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    @MaxLength(40)
    slug!: string

    /** The customer phone. */
    @Field()
    @IsString()
    @MaxLength(30)
    phone!: string
}
