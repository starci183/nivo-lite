import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardConnectionType } from "./agent-dashboard-connection.type"

@ObjectType()
/** The connections region of the dashboard: its data, or the fact that it could not be read. */
export class AgentDashboardConnectionsRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The data of the region; absent when it could not be read. */
    @Field(() => [AgentDashboardConnectionType], { nullable: true })
    data?: ReadonlyArray<AgentDashboardConnectionType> | null
}
