import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A connection an agent is allowed to use, and whether it is bound to it. */
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

    /** Whether the agent is bound to it. */
    @Field()
    bound!: boolean

    /** Deprecated: `auto` when bound, null when not (rights live in the agent's attachments). */
    @Field(() => String, { nullable: true, deprecationReason: "Rights live in the agent's attachments (tab Quyền); a binding has no level. Always \"auto\" for a bound pair; removed next release." })
    access!: string | null
}
