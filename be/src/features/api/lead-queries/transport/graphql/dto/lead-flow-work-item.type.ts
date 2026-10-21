import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { LeadFlowLeadType } from "./lead-flow-lead.type"
import { LeadFlowProposalType } from "./lead-flow-proposal.type"
import { LeadFlowResultType } from "./lead-flow-result.type"

@ObjectType()
/** A work item with the display details required by the lead flow. */
export class LeadFlowWorkItemType {
    /** The work item id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the work item. */
    @Field(() => ID)
    workspaceId!: string

    /** The department responsible for executing the action. */
    @Field()
    department!: string

    /** The registered action assigned to this work item. */
    @Field()
    action!: string

    /** The kind of record the action operates on. */
    @Field()
    subjectType!: string

    /** The record the action operates on, when available. */
    @Field(() => ID, { nullable: true })
    subjectId!: string | null

    /** The lead associated with this work item. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The inbound event that initiated the work. */
    @Field(() => ID, { nullable: true })
    inboundEventId!: string | null

    /** The preceding work item in the command chain. */
    @Field(() => ID, { nullable: true })
    parentId!: string | null

    /** The root work item that identifies the command chain. */
    @Field(() => ID, { nullable: true })
    chainId!: string | null

    /** The number of hops from the root work item. */
    @Field(() => Int)
    depth!: number

    /** The current execution or review status. */
    @Field()
    status!: string

    /** Whether the action was decided automatically or by a human. */
    @Field(() => String, { nullable: true })
    decidedPath!: string | null

    /** The primary reason code for the current decision state. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** All reason codes produced by the authority gate. */
    @Field(() => [String])
    reasons!: Array<string>

    /** The input fields still required before execution. */
    @Field(() => [String])
    missingFields!: Array<string>

    /** The proposed action and its supporting values. */
    @Field(() => LeadFlowProposalType)
    proposal!: LeadFlowProposalType

    /** The recorded outcome once the action completes. */
    @Field(() => LeadFlowResultType, { nullable: true })
    result!: LeadFlowResultType | null

    /** The recorded failure detail, when execution failed. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** The current evidence capture and verification state. */
    @Field()
    evidenceState!: string

    /** The staff member assigned to the action. */
    @Field(() => ID, { nullable: true })
    assignedStaffId!: string | null

    /** The linked execution record, when present. */
    @Field(() => ID, { nullable: true })
    executionId!: string | null

    /** When the work item was created, in ISO 8601 format. */
    @Field()
    createdAt!: string

    /** When the work item was last updated, in ISO 8601 format. */
    @Field()
    updatedAt!: string

    /** When execution completed, in ISO 8601 format. */
    @Field(() => String, { nullable: true })
    completedAt!: string | null

    /** The agent installation responsible for the work. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** The lead contact details shown beside the work item. */
    @Field(() => LeadFlowLeadType, { nullable: true })
    lead!: LeadFlowLeadType | null

    /** The display name of the assigned staff member. */
    @Field(() => String, { nullable: true })
    assignedStaffName!: string | null

    /** Whether an existing execution approval card already displays this item. */
    @Field()
    hasApprovalCard!: boolean

    /** The destination for inspecting or acting on this work item. */
    @Field()
    href!: string

    /** The identity that made the latest decision, when requested. */
    @Field(() => String, { nullable: true })
    decidedBy!: string | null
}
