import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The installed agent of the dashboard. */
export class AgentDashboardAgentType {
    /** The agent. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** `assist` or `autopilot`. */
    @Field()
    mode!: string
}
