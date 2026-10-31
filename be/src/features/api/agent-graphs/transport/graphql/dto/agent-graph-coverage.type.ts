import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A person of an approver group who cannot answer, and why. */
export class AgentGraphExcludedType {
    /** The name of the person. */
    @Field(() => String)
    name!: string

    /** Why: inactive, no_grant or over_limit. */
    @Field(() => String)
    reason!: string
}

@ObjectType()
/** Who can answer one ask of the graph of an agent. */
export class AgentGraphCoverageType {
    /** The node that asks. */
    @Field(() => String)
    nodeKey!: string

    /** The branch that asks, or null for an approval step. */
    @Field(() => String, { nullable: true })
    branchKey!: string | null

    /** The top of the amounts the branch covers, or null when it has none. */
    @Field(() => Float, { nullable: true })
    top!: number | null

    /** The names of the people a request would go to. */
    @Field(() => [String])
    approvers!: ReadonlyArray<string>

    /** The people of the group left out, with the reason. */
    @Field(() => [AgentGraphExcludedType])
    excluded!: ReadonlyArray<AgentGraphExcludedType>

    /** False when nobody can approve up to the top of the branch. */
    @Field(() => Boolean)
    covered!: boolean
}
