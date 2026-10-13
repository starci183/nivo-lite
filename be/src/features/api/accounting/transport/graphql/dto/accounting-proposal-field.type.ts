import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Proposal Field returned by GraphQL. */
export class AccountingProposalFieldType {
    /** name. */
    @Field(() => String)
    name!: string

    /** text. */
    @Field(() => String, { nullable: true })
    text!: string | null

    /** number. */
    @Field(() => Float, { nullable: true })
    number!: number | null
}
