import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The recurring contract as saved. */
export class SaveContractType {
    /** The contract id. */
    @Field(() => ID)
    id!: string

    /** The linked customer, when known. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer name. */
    @Field()
    customerName!: string

    /** The plan the customer buys. */
    @Field()
    plan!: string

    /** The first day, YYYY-MM-DD. */
    @Field()
    startsOn!: string

    /** The last day, YYYY-MM-DD. */
    @Field()
    endsOn!: string

    /** The amount in whole dong, when agreed. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The current contract status. */
    @Field()
    status!: string

    /** A free note. */
    @Field()
    note!: string
}
