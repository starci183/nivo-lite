import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentDashboardItemType } from "./agent-dashboard-item.type"

@ObjectType()
/** The decisions of the module that wait for a person. */
export class AgentDashboardWaitingType {
    /** How many wait. */
    @Field(() => Int)
    total!: number

    /** The oldest few. */
    @Field(() => [AgentDashboardItemType])
    items!: ReadonlyArray<AgentDashboardItemType>
}
