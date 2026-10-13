import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that draft an offer for a candidate and ask for approval. */
export class RequestHiringOfferInput {
    /** The candidate. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    candidateId!: string

    /** The position as written in the offer. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    title!: string

    /** The pay. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    pay!: string

    /** The start date. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    startDate!: string

    /** The probation. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    probation!: string

    /** A free note. */
    @Field(() => String)
    @IsString()
    @MaxLength(2000)
    note!: string
}
