import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One data row of a contract sheet read as a contract, with its problems. */
export class ContractImportRowType {
    /** The row number in the sheet (the header row is 1). */
    @Field(() => Int)
    row!: number

    /** The customer name. */
    @Field()
    customerName!: string

    /** The plan. */
    @Field()
    plan!: string

    /** The first day, YYYY-MM-DD, when it can be read or derived. */
    @Field(() => String, { nullable: true })
    startsOn!: string | null

    /** The last day, YYYY-MM-DD, when it can be read. */
    @Field(() => String, { nullable: true })
    endsOn!: string | null

    /** The amount in whole dong, when given. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** `active`, `ended` or `cancelled`. */
    @Field()
    status!: string

    /** The note, with a derived start flagged. */
    @Field()
    note!: string

    /** The problem codes; any but `startsOnDerived` keeps the row out. */
    @Field(() => [String])
    problems!: ReadonlyArray<string>
}
