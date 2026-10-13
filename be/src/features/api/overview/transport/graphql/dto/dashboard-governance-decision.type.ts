import { Field, ID, ObjectType } from "@nestjs/graphql"

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
    @Field()
    deciderKind!: string

    /** The outcome. */
    @Field()
    outcome!: string

    /** When it was decided, ISO 8601. */
    @Field()
    createdAt!: string
}
