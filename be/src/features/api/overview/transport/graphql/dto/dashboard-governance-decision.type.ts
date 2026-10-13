import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql"
import { GovernanceDeciderKind, GovernanceDecisionOutcome } from "@modules/domain/overview"

registerEnumType(GovernanceDeciderKind, { name: "GovernanceDeciderKind" })
registerEnumType(GovernanceDecisionOutcome, { name: "GovernanceDecisionOutcome" })

@ObjectType()
/** A decision row of the last 7 days. */
export class DashboardGovernanceDecisionType {
    /** The work item decided, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** `policy`, `owner` or `staff`. */
    @Field(() => GovernanceDeciderKind)
    deciderKind!: GovernanceDeciderKind

    /** The outcome. */
    @Field(() => GovernanceDecisionOutcome)
    outcome!: GovernanceDecisionOutcome

    /** When it was decided, ISO 8601. */
    @Field()
    createdAt!: string
}
