import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The header of an agent's profile page. */
export class AgentPageHeadType {
    /** The agent. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The @handle. */
    @Field()
    handle!: string

    /** The one-line role. */
    @Field()
    role!: string

    /** The module (agent type). */
    @Field()
    module!: string

    /** `active` or `paused`. */
    @Field()
    status!: string

    /** The HTTPS address of the agent's picture; null for the generated avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl?: string | null

    /** The department room the agent is at home in, or null. */
    @Field(() => String, { nullable: true })
    roomName?: string | null

    /** `assist` (asks first) or `autopilot`; null when no instance drives the agent. */
    @Field(() => String, { nullable: true })
    operatingMode?: string | null
}
