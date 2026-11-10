import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent granted a connection: what it uses it for and what it may do through it. */
export class ConnectionAgentGrantType {
    /** The connection. */
    @Field(() => ID)
    connectionId!: string

    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The display name of the agent. */
    @Field()
    agentName!: string

    /** The module the agent belongs to. */
    @Field()
    module!: string

    /** What the agent uses the connection for. */
    @Field()
    purpose!: string
}
