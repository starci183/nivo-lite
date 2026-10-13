import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded slug of a public points check. */
export class PublicLoyaltyPageInput {
    /** The published loyalty program slug. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    @MaxLength(40)
    slug!: string
}
