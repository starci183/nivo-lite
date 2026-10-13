import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded phone and code used to unlock a points check. */
export class VerifyLoyaltyCodeInput {
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

    /** The code delivered to the customer's own chat. */
    @Field()
    @IsString()
    @MaxLength(20)
    code!: string
}
