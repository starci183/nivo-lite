import { Field, Float, ObjectType } from "@nestjs/graphql"
import { LeadFlowCandidateType } from "./lead-flow-candidate.type"
import { LeadFlowProposalFieldType } from "./lead-flow-proposal-field.type"

@ObjectType()
/** The proposed action and supporting values awaiting execution or review. */
export class LeadFlowProposalType {
    /** A human-readable explanation of the proposed action. */
    @Field()
    summary!: string

    /** The draft content to send or apply. */
    @Field(() => String, { nullable: true })
    draft!: string | null

    /** The proposed amount in Vietnamese dong. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** Dynamic proposal values represented as typed key-value entries. */
    @Field(() => [LeadFlowProposalFieldType])
    fields!: Array<LeadFlowProposalFieldType>

    /** The confidence reported when the proposal was created. */
    @Field(() => Float, { nullable: true })
    confidence!: number | null

    /** Whether the proposed outcome is clear or unclear. */
    @Field(() => String, { nullable: true })
    outcome!: string | null

    /** Candidate records available for a reviewer to choose. */
    @Field(() => [LeadFlowCandidateType], { nullable: true })
    candidates!: Array<LeadFlowCandidateType> | null
}
