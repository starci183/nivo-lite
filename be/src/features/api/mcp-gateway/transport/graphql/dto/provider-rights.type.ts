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
/** One ability of a provider: a right in business words. */
export class ProviderAbilityType {
    /** The ability id. */
    @Field(() => String)
    id!: string

    /** Its name. */
    @Field(() => AbilityLabelType)
    label!: AbilityLabelType

    /** read (ticked or not) or write (ticked auto or ask). */
    @Field(() => String)
    scope!: string

    /** The tools it holds. */
    @Field(() => [String])
    tools!: Array<string>
}

@ObjectType()
/** One connected account of a provider: one connection (one Zalo OA, one bank account, one sheet). */
export class ProviderAccountType {
    /** The connection id: the key of every attachment and tick. */
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

    /** True when it is the shop's default account of its kind: the receiving account a payment QR is drawn on. */
    @Field(() => Boolean)
    isDefaultReceiving!: boolean
}

@ObjectType()
/** One provider with its abilities (once) and the workspace's accounts of it. */
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

    /** Its abilities; none means no agent can be attached to it. */
    @Field(() => [ProviderAbilityType])
    abilities!: Array<ProviderAbilityType>
}

@ObjectType()
/** One ticked ability: its id and the mode it is held in. */
export class AbilityTickType {
    /** The ability id. */
    @Field(() => String)
    id!: string

    /** auto or ask. */
    @Field(() => String)
    mode!: string
}

@ObjectType()
/** One agent attached to one provider, with the abilities ticked. */
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

    /** The abilities ticked; an ability not listed is off. */
    @Field(() => [AbilityTickType])
    abilities!: Array<AbilityTickType>
}

@ObjectType()
/** The rights board of a workspace: the providers with their abilities, and every attachment. */
export class ProviderRightsType {
    /** Every provider. */
    @Field(() => [ProviderRightType])
    providers!: Array<ProviderRightType>

    /** Every attachment of the workspace. */
    @Field(() => [AgentAttachmentType])
    attachments!: Array<AgentAttachmentType>
}

@ObjectType()
/** One line of a template's proposal for a fresh agent: a connected account with its ticks, or a provider that is not connected. */
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

    /** The abilities the template ticks on the account; none on a provider that is not connected. */
    @Field(() => [AbilityTickType])
    abilities!: Array<AbilityTickType>

    /** True for a working account: only then is a fresh agent attached. */
    @Field(() => Boolean)
    connected!: boolean
}

@ObjectType()
/** An agent a template would attach to a provider, with the ticks it proposes. */
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

    /** The abilities the template ticks. */
    @Field(() => [AbilityTickType])
    abilities!: Array<AbilityTickType>
}
