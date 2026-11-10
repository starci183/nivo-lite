import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One connection granted to an agent, with the purpose and access of the grant. */
export class AgentCatalogGrantType {
    /** The connection. */
    @Field(() => ID)
    connectionId!: string

    /** The provider key (telegram, zalo_oa, sepay...). */
    @Field()
    provider!: string

    /** The display name of the connection. */
    @Field()
    name!: string

    /** The bot username, when the provider has one. */
    @Field(() => String, { nullable: true })
    botUsername!: string | null

    /** The masked bank account, when the connection is a bank feed. */
    @Field(() => String, { nullable: true })
    accountMasked!: string | null

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
