import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The terms of an offer. */
export class HiringOfferTermsType {
    /** The position. */
    @Field(() => String)
    title!: string

    /** The pay as written. */
    @Field(() => String)
    pay!: string

    /** The start date as written. */
    @Field(() => String)
    startDate!: string

    /** The probation as written. */
    @Field(() => String)
    probation!: string

    /** A free note. */
    @Field(() => String)
    note!: string
}
