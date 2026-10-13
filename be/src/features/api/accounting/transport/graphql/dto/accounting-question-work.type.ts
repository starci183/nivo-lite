import { Field, ObjectType, Int } from "@nestjs/graphql"
import { AccountingProposalType } from "./accounting-proposal.type"
import { AccountingWorkResultType } from "./accounting-work-result.type"
import { AccountingQuestionLeadType } from "./accounting-question-lead.type"

@ObjectType()
/** Accounting Question Work returned by GraphQL. */
export class AccountingQuestionWorkType {
    /** id. */
    @Field(() => String)
    id!: string

    /** workspace Id. */
    @Field(() => String)
    workspaceId!: string

    /** department. */
    @Field(() => String)
    department!: string

    /** action. */
    @Field(() => String)
    action!: string

    /** subject Type. */
    @Field(() => String)
    subjectType!: string

    /** subject Id. */
    @Field(() => String, { nullable: true })
    subjectId!: string | null

    /** lead Id. */
    @Field(() => String, { nullable: true })
    leadId!: string | null

    /** inbound Event Id. */
    @Field(() => String, { nullable: true })
    inboundEventId!: string | null

    /** parent Id. */
    @Field(() => String, { nullable: true })
    parentId!: string | null

    /** chain Id. */
    @Field(() => String, { nullable: true })
    chainId!: string | null

    /** depth. */
    @Field(() => Int)
    depth!: number

    /** status. */
    @Field(() => String)
    status!: string

    /** decided Path. */
    @Field(() => String, { nullable: true })
    decidedPath!: string | null

    /** reason. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** reasons. */
    @Field(() => [String])
    reasons!: ReadonlyArray<string>

    /** missing Fields. */
    @Field(() => [String])
    missingFields!: ReadonlyArray<string>

    /** proposal. */
    @Field(() => AccountingProposalType)
    proposal!: AccountingProposalType

    /** result. */
    @Field(() => AccountingWorkResultType, { nullable: true })
    result!: AccountingWorkResultType | null

    /** error. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** evidence State. */
    @Field(() => String)
    evidenceState!: string

    /** assigned Staff Id. */
    @Field(() => String, { nullable: true })
    assignedStaffId!: string | null

    /** assigned Staff Name. */
    @Field(() => String, { nullable: true })
    assignedStaffName!: string | null

    /** execution Id. */
    @Field(() => String, { nullable: true })
    executionId!: string | null

    /** origin. */
    @Field(() => String)
    origin!: string

    /** created At. */
    @Field(() => String)
    createdAt!: string

    /** updated At. */
    @Field(() => String)
    updatedAt!: string

    /** completed At. */
    @Field(() => String, { nullable: true })
    completedAt!: string | null

    /** installation Id. */
    @Field(() => String, { nullable: true })
    installationId!: string | null

    /** lead. */
    @Field(() => AccountingQuestionLeadType, { nullable: true })
    lead!: AccountingQuestionLeadType | null
}
