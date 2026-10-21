import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Measure returned by GraphQL. */
export class AccountingMeasureType {
    /** The VND amount. */
    @Field(() => Float)
    vnd!: number

    /** The record count. */
    @Field(() => Int)
    count!: number
}
