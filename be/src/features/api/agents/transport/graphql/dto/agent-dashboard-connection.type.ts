import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One connection bound to the agent. */
export class AgentDashboardConnectionType {
    /** The connection. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The provider key. */
    @Field()
    provider!: string

    /** `connected`, `error` or `pending`. */
    @Field()
    status!: string

    /** What the agent may do through it. */
    @Field()
    access!: string

    /** What the agent uses it for. */
    @Field()
    purpose!: string
}
