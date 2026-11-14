import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Words in the owner's two languages, exactly as the trigger catalogue declares them. */
export class ProviderTriggerWordsType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** An agent the owner may bind as the decider of a trigger: attached to the account. */
export class ProviderTriggerAgentChoiceType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** Its name. */
    @Field(() => String)
    name!: string
}

@ObjectType()
/** One trigger of a connected account: its switch, who decides on its events, and the agents a binding may name. */
export class ProviderTriggerStateType {
    /** The account. */
    @Field(() => ID)
    connectionId!: string

    /** The trigger name inside the provider (`transaction.received`). */
    @Field(() => String)
    name!: string

    /** `webhook` or `poll`. */
    @Field(() => String)
    kind!: string

    /** What it is, in the owner's two languages. */
    @Field(() => ProviderTriggerWordsType)
    summary!: ProviderTriggerWordsType

    /** Whether the switch is on (off until the owner turns it on). */
    @Field(() => Boolean)
    enabled!: boolean

    /** Since when it is on, ISO 8601; null when off, and when it was turned on to catch up on every event. */
    @Field(() => String, { nullable: true })
    enabledAt!: string | null

    /** When it last handed an event on, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    lastFiredAt!: string | null

    /** How many events it handed on. */
    @Field(() => Int)
    firedCount!: number

    /** True when one agent decides on its events and every other registered one is only told. */
    @Field(() => Boolean)
    decided!: boolean

    /** The agent that decides now (the core agent while it is bound, else the one the owner bound), or null. */
    @Field(() => ID, { nullable: true })
    deciderAgentId!: string | null

    /** That agent's name, or null. */
    @Field(() => String, { nullable: true })
    deciderAgentName!: string | null

    /** True while the provider's own core path hands the account's events to an agent: no other agent can be bound. */
    @Field(() => Boolean)
    coreDecides!: boolean

    /** True when turning the switch on again may catch up on the events missed while it was off. */
    @Field(() => Boolean)
    canCatchUp!: boolean

    /** The agents a binding may name; empty when nobody decides or a core agent decides. */
    @Field(() => [ProviderTriggerAgentChoiceType])
    deciderChoices!: ReadonlyArray<ProviderTriggerAgentChoiceType>
}
