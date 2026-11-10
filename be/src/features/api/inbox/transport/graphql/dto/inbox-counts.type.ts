import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How many customers each tab of the list holds. */
export class InboxCountsType {
    /** Every customer. */
    @Field(() => Int)
    all!: number

    /** New customers. */
    @Field(() => Int)
    new!: number

    /** Customers something waits on the owner for. */
    @Field(() => Int)
    needsYou!: number

    /** Customers with an order. */
    @Field(() => Int)
    ordered!: number

    /** Customers whose money came in. */
    @Field(() => Int)
    paid!: number
}
