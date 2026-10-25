import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An agent as the instance list shows it. */
export class AgentSummaryType {
    /** The agent. */
    @Field(() => ID)
    id!: string

    /** The module the agent belongs to. */
    @Field()
    module!: string

    /** The display name. */
    @Field()
    name!: string

    /** The @handle, unique in the workspace. */
    @Field()
    handle!: string

    /** The one-line role. */
    @Field()
    role!: string

    /** `active` or `paused`. */
    @Field()
    status!: string

    /** The HTTPS address of the agent's picture; null for the generated avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl?: string | null

    /** When the agent was created, ISO 8601. */
    @Field()
    createdAt!: string
}
