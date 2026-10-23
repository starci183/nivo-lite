import { Field, Float, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { ProposalCandidateType } from "./proposal-candidate.type"

@ObjectType()
/** What an agent proposes to do. */
export class ProposalType {
    /** One sentence for the owner. */
    @Field()
    summary!: string

    /** The text to send, when the action sends one. */
    @Field(() => String, { nullable: true })
    draft?: string | null | undefined

    /** The money involved, VND. */
    @Field(() => Float, { nullable: true })
    amount_vnd?: number | null | undefined

    /** The structured fields of the proposal: a name to a text, a number or null. */
    @Field(() => GraphqlJsonObject)
    fields!: object

    /** How sure the agent is, 0..1. */
    @Field(() => Float, { nullable: true })
    confidence?: number | null | undefined

    /** `clear` or `unclear`. */
    @Field(() => String, { nullable: true })
    outcome?: string | null | undefined

    /** The invoices a payment may settle. */
    @Field(() => [ProposalCandidateType], { nullable: true })
    candidates?: ReadonlyArray<ProposalCandidateType> | null | undefined
}
