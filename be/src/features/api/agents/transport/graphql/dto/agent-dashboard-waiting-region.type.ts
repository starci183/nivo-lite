import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardWaitingType } from "./agent-dashboard-waiting.type"

@ObjectType()
/** The waiting decisions region of the dashboard: its data, or the fact that it could not be read. */
export class AgentDashboardWaitingRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The data of the region; absent when it could not be read. */
    @Field(() => AgentDashboardWaitingType, { nullable: true })
    data?: AgentDashboardWaitingType | null
}
