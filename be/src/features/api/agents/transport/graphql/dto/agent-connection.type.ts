import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A connection granted to an agent. */
export class AgentConnectionType {
    /** The connection. */
    @Field(() => ID)
    id!: string

    /** The provider (telegram, zalo_oa...). */
    @Field()
    provider!: string

    /** The bot username, when the provider has one. */
    @Field(() => String, { nullable: true })
    botUsername!: string | null

    /** The masked bank account, when the connection is a bank feed. */
    @Field(() => String, { nullable: true })
    accountMasked!: string | null

    /** The display name. */
    @Field()
    name!: string

    /** `connected`, `error`, `pending` or `disconnected`. */
    @Field()
    status!: string

    /** `read`, `ask` or `auto`. */
    @Field()
    access!: string

    /** What the agent uses the connection for. */
    @Field()
    purpose!: string
}
