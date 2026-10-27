import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A contract still without a way to reach its customer. */
export class UnmatchedContractType {
    /** The contract id. */
    @Field(() => ID)
    contractId!: string

    /** The customer name the contract carries. */
    @Field()
    customerName!: string

    /** `noCustomer`, `noContact` or `ambiguous`. */
    @Field()
    reason!: string
}
