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
/** One provider with its abilities and whether the workspace connected it. */
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

    /** The name of the workspace's working connection of it (the account it reaches), or null when it is not connected. */
    @Field(() => String, { nullable: true })
    accountLabel!: string | null

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

    /** The provider. */
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
/** One provider a template names for a fresh agent, with the ticks it proposes. */
export class ProposedAttachmentType {
    /** The provider. */
    @Field(() => String)
    provider!: string

    /** The abilities the template ticks. */
    @Field(() => [AbilityTickType])
    abilities!: Array<AbilityTickType>

    /** True when the workspace connected the provider: only then is a fresh agent attached to it. */
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
