import { Field, ObjectType } from "@nestjs/graphql"
import { PublicTermsType } from "./public-terms.type"

@ObjectType()
/** An offer read from the candidate's link. */
export class PublicOfferType {
    /** The offer status. */
    @Field(() => String)
    status!: string

    /** The candidate. */
    @Field(() => String)
    candidateName!: string

    /** The job. */
    @Field(() => String)
    jobTitle!: string

    /** The place of work. */
    @Field(() => String)
    location!: string

    /** The business. */
    @Field(() => String)
    shop!: string

    /** The letter text. */
    @Field(() => String)
    letter!: string

    /** When the offer lapses. */
    @Field(() => String, { nullable: true })
    expiresAt!: string | null

    /** The terms. */
    @Field(() => PublicTermsType)
    terms!: PublicTermsType
}
