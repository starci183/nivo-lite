import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A display name in the owner's two languages. */
export class AbilityLabelType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** One connected account of a provider: one connection (one Zalo OA, one bank account, one sheet). */
export class ProviderAccountType {
    /** The connection id: the key of every attachment. */
    @Field(() => ID)
    connectionId!: string

    /** The provider it is an account of. */
    @Field(() => String)
    provider!: string

    /** Its kind: messaging, payment or books. */
    @Field(() => String)
    kind!: string

    /** The name of the account (the connection's name, with the masked account number when the provider reported one). */
    @Field(() => String)
    accountLabel!: string

    /** True when the connection works: only then can an agent be attached to it. */
    @Field(() => Boolean)
    connected!: boolean
}

@ObjectType()
/** One provider with the tools it serves and the workspace's accounts of it. */
export class ProviderRightType {
    /** The provider key. */
    @Field(() => String)
    provider!: string

    /** Its name. */
    @Field(() => AbilityLabelType)
    label!: AbilityLabelType

    /** Its kind: messaging, payment or books (a display category). */
    @Field(() => String)
    kind!: string

    /** The name of its kind. */
    @Field(() => AbilityLabelType)
    kindLabel!: AbilityLabelType

    /** True when the workspace holds a working connection of it. */
    @Field(() => Boolean)
    connected!: boolean

    /** The workspace's accounts of it (one per connection), oldest first: what an agent is attached to. */
    @Field(() => [ProviderAccountType])
    accounts!: Array<ProviderAccountType>

    /** The tools it serves (information for picking an account; not a right). None means no agent can be attached to it. */
    @Field(() => [String])
    tools!: Array<string>
}

@ObjectType()
/** One agent attached to one connected account: the attachment holds nothing else. */
export class AgentAttachmentType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The connected account the agent is attached to. */
    @Field(() => ID)
    connectionId!: string

    /** The provider of that account. */
    @Field(() => String)
    provider!: string
}

@ObjectType()
/** The provider board of a workspace: the providers with their tools and accounts, and every attachment. */
export class ProviderRightsType {
    /** Every provider. */
    @Field(() => [ProviderRightType])
    providers!: Array<ProviderRightType>

    /** Every attachment of the workspace. */
    @Field(() => [AgentAttachmentType])
    attachments!: Array<AgentAttachmentType>
}

@ObjectType()
/** One line of a template's proposal for a fresh agent: a connected account, or a provider that is not connected. */
export class ProposedAttachmentType {
    /** The provider. */
    @Field(() => String)
    provider!: string

    /** The connected account, or null on the line of a provider the workspace has not connected. */
    @Field(() => ID, { nullable: true })
    connectionId!: string | null

    /** The name of the account, or null. */
    @Field(() => String, { nullable: true })
    accountLabel!: string | null

    /** True for a working account: only then is a fresh agent attached. */
    @Field(() => Boolean)
    connected!: boolean
}

@ObjectType()
/** An agent a template would attach to a provider. */
export class ProviderTemplateCandidateType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** Its name. */
    @Field(() => String)
    agentName!: string

    /** Its module. */
    @Field(() => String)
    module!: string
}
