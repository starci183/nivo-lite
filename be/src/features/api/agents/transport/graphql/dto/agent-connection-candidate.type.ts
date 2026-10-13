import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A connection an agent is allowed to use, with the access it already has. */
export class AgentConnectionCandidateType {
    /** The connection. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The provider key. */
    @Field()
    provider!: string

    /** The bot username, when the provider has one. */
    @Field(() => String, { nullable: true })
    botUsername!: string | null

    /** The masked bank account, when the connection is a bank feed. */
    @Field(() => String, { nullable: true })
    accountMasked!: string | null

    /** `pending`, `connected`, `error` or `disconnected`. */
    @Field()
    status!: string

    /** What this agent would use it for. */
    @Field()
    purpose!: string

    /** `read`, `ask` or `auto`, or null when the agent has no access yet. */
    @Field(() => String, { nullable: true })
    access!: string | null
}
