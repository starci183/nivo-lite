import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How many documents the agent can read, by visibility. */
export class AgentDashboardDocumentCountsType {
    /** Documents anyone may see. */
    @Field(() => Int)
    public!: number

    /** Documents for the team. */
    @Field(() => Int)
    internal!: number
}
