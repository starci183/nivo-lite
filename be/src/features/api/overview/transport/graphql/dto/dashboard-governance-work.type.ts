import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql"
import { GovernanceDecidedPath, GovernanceWorkReason, GovernanceWorkStatus } from "@modules/domain/overview"

registerEnumType(GovernanceWorkStatus, { name: "GovernanceWorkStatus" })
registerEnumType(GovernanceDecidedPath, { name: "GovernanceDecidedPath" })
registerEnumType(GovernanceWorkReason, { name: "GovernanceWorkReason" })

@ObjectType()
/** A work item row behind the governance figures. */
export class DashboardGovernanceWorkType {
    /** The work item id. */
    @Field(() => ID)
    id!: string

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The department. */
    @Field()
    department!: string

    /** The work status. */
    @Field(() => GovernanceWorkStatus)
    status!: GovernanceWorkStatus

    /** The reason code, or null. */
    @Field(() => GovernanceWorkReason, { nullable: true })
    reason!: GovernanceWorkReason | null

    /** `auto`, `human` or null. */
    @Field(() => GovernanceDecidedPath, { nullable: true })
    decidedPath!: GovernanceDecidedPath | null

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** When it last changed, ISO 8601. */
    @Field()
    updatedAt!: string

    /** When it finished, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    completedAt!: string | null

    /** The proposal summary, or null. */
    @Field(() => String, { nullable: true })
    summary!: string | null

    /** The proposal contact name, or null. */
    @Field(() => String, { nullable: true })
    contact!: string | null

    /** The proposal customer, or null. */
    @Field(() => String, { nullable: true })
    customer!: string | null
}
