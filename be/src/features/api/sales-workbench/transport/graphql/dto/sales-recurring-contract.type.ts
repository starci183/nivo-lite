import { Field, ObjectType, ID, Float } from "@nestjs/graphql"

@ObjectType()
/** One recurring Sales contract. */
export class SalesRecurringContractType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer name. */
    @Field(() => String)
    customerName!: string

    /** The plan. */
    @Field(() => String)
    plan!: string

    /** The starts on. */
    @Field(() => String)
    startsOn!: string

    /** The ends on. */
    @Field(() => String)
    endsOn!: string

    /** The amount vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The status. */
    @Field(() => String)
    status!: string

    /** The note. */
    @Field(() => String)
    note!: string
}
