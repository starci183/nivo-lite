import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One invoice a payment may settle. */
export class ProposalCandidateType {
    /** The invoice id. */
    @Field(() => ID)
    id!: string

    /** The line the owner reads. */
    @Field()
    label!: string

    /** The amount of the invoice, VND. */
    @Field(() => Float)
    amount_vnd!: number
}
