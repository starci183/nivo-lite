import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One tax deadline or supplier payment falling due, returned by GraphQL. */
export class AccountingUpcomingDueType {
    /** Whether this is a tax deadline or a supplier invoice. */
    @Field(() => String)
    source!: string

    /** The obligation kind, or the supplier payment. */
    @Field(() => String)
    kind!: string

    /** The covered period, or the invoice number. */
    @Field(() => String)
    ref!: string

    /** The due date, `YYYY-MM-DD`. */
    @Field(() => String)
    dueOn!: string

    /** Whole days from today; negative when past. */
    @Field(() => Int)
    daysLeft!: number

    /** The amount when known, in VND. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The legal basis of a tax deadline, or the supplier name. */
    @Field(() => String)
    note!: string
}
