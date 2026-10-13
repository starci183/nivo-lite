import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded slug of a public booking page. */
export class PublicBookingPageInput {
    /** The published booking page slug. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string
}
