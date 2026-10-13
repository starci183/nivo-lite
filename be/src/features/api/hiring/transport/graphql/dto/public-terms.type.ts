import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The terms of an offer. */
export class PublicTermsType {
    /** The position. */
    @Field(() => String)
    title!: string

    /** The pay. */
    @Field(() => String)
    pay!: string

    /** The start date. */
    @Field(() => String)
    startDate!: string

    /** The probation. */
    @Field(() => String)
    probation!: string

    /** A free note. */
    @Field(() => String)
    note!: string
}
