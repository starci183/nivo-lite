import { Field, ObjectType } from "@nestjs/graphql"
import { AgentRecentWorkType } from "./agent-recent-work.type"

@ObjectType()
/** The recent work region of the agent page: its lines, or the fact that they could not be read. */
export class AgentRecentRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The work; absent when it could not be read. */
    @Field(() => [AgentRecentWorkType], { nullable: true })
    data?: ReadonlyArray<AgentRecentWorkType> | null
}
