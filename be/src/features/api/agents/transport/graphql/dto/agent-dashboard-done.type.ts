import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentDashboardItemType } from "./agent-dashboard-item.type"

@ObjectType()
/** The work finished by policy in the last seven days. */
export class AgentDashboardDoneType {
    /** How many finished. */
    @Field(() => Int)
    count!: number

    /** The latest few. */
    @Field(() => [AgentDashboardItemType])
    items!: ReadonlyArray<AgentDashboardItemType>
}
