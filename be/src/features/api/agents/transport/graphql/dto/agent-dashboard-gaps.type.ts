import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentDashboardGapType } from "./agent-dashboard-gap.type"

@ObjectType()
/** The open gaps of a module. */
export class AgentDashboardGapsType {
    /** How many gaps are open. */
    @Field(() => Int)
    openCount!: number

    /** The most asked few. */
    @Field(() => [AgentDashboardGapType])
    items!: ReadonlyArray<AgentDashboardGapType>
}
