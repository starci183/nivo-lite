import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How many facts the agent can read, by visibility. */
export class AgentDashboardFactCountsType {
    /** Facts anyone may see. */
    @Field(() => Int)
    public!: number

    /** Facts for the team. */
    @Field(() => Int)
    internal!: number

    /** Facts restricted to named agents. */
    @Field(() => Int)
    restricted!: number
}
