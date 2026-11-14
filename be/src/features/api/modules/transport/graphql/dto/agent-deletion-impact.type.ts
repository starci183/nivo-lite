import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One record type the removed agent owns records of, with how many. */
export class AgentDeletionImpactRecordTypeType {
    /** How many records of the type die with the agent. */
    @Field(() => Int)
    count!: number

    /** An English fallback title read from the type id (a page maps the id to its own label). */
    @Field()
    title!: string

    /** The record type id (`blocks-core.chatbot.message`). */
    @Field()
    type!: string
}

@ObjectType()
/** One customer channel that would have NO agent answering once the agent is removed. */
export class AgentDeletionImpactChannelType {
    /** `connection` (a provider account), `website` (the hosted site) or `api_key` (a public API key). */
    @Field()
    kind!: string

    /** The connection's display name, the site's public key, or the key's name. */
    @Field()
    name!: string

    /** The provider of a `connection` (`zalo_oa`, `telegram`); null for the other kinds. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** The connection id of a `connection`; null for the other kinds. */
    @Field(() => ID, { nullable: true })
    connectionId!: string | null
}

@ObjectType()
/** What removing an installed agent takes with it: the warning shown before the removal. */
export class AgentDeletionImpactType {
    /** The customer channels left with no agent answering once the agent is removed (connections, then the website, then public API keys). */
    @Field(() => [AgentDeletionImpactChannelType])
    channels!: ReadonlyArray<AgentDeletionImpactChannelType>

    /** The agent of the installation, or null when it has none. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The files the agent's records hold. */
    @Field(() => Int)
    files!: number

    /** The installation asked about. */
    @Field(() => ID)
    installationId!: string

    /** The record types the agent owns records of (most first). */
    @Field(() => [AgentDeletionImpactRecordTypeType])
    recordTypes!: ReadonlyArray<AgentDeletionImpactRecordTypeType>

    /** Every record of the agent. */
    @Field(() => Int)
    records!: number
}
