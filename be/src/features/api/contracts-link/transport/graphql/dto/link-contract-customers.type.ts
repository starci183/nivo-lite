import { Field, Int, ObjectType } from "@nestjs/graphql"
import { UnmatchedContractType } from "./unmatched-contract.type"

@ObjectType()
/** What linking the contracts of a workspace to their customers did. */
export class LinkContractCustomersType {
    /** How many contracts now reach a lead they did not reach before. */
    @Field(() => Int)
    linked!: number

    /** How many leads were created. */
    @Field(() => Int)
    created!: number

    /** The contracts still without a phone or an email to reach the customer by. */
    @Field(() => [UnmatchedContractType])
    unmatched!: Array<UnmatchedContractType>
}
