import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that accept or decline an offer. */
export class RespondHiringOfferInput {
    /** The link token. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    token!: string

    /** Whether the candidate accepts. */
    @Field(() => Boolean)
    @IsBoolean()
    accept!: boolean
}
