import { Field, ObjectType, Float } from "@nestjs/graphql"
import { AccountingProposalFieldType } from "./accounting-proposal-field.type"
import { AccountingCandidateType } from "./accounting-candidate.type"

@ObjectType()
/** Accounting Proposal returned by GraphQL. */
export class AccountingProposalType {
    /** summary. */
    @Field(() => String)
    summary!: string

    /** draft. */
    @Field(() => String, { nullable: true })
    draft!: string | null

    /** amount Vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** confidence. */
    @Field(() => Float, { nullable: true })
    confidence!: number | null

    /** outcome. */
    @Field(() => String, { nullable: true })
    outcome!: string | null

    /** fields. */
    @Field(() => [AccountingProposalFieldType])
    fields!: ReadonlyArray<AccountingProposalFieldType>

    /** candidates. */
    @Field(() => [AccountingCandidateType])
    candidates!: ReadonlyArray<AccountingCandidateType>
}
