import { Field, ObjectType } from "@nestjs/graphql"
import { AgentDashboardDoneType } from "./agent-dashboard-done.type"

@ObjectType()
/** The finished work region of the dashboard: its data, or the fact that it could not be read. */
export class AgentDashboardDoneRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The data of the region; absent when it could not be read. */
    @Field(() => AgentDashboardDoneType, { nullable: true })
    data?: AgentDashboardDoneType | null
}
