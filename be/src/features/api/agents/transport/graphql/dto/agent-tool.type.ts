import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A text in both product languages. */
export class AgentToolTextType {
    /** Vietnamese. */
    @Field()
    vi!: string

    /** English. */
    @Field()
    en!: string
}

@ObjectType()
/** One connected account through which the agent may call a provider tool, and how. */
export class AgentToolAccountType {
    /** The connection. */
    @Field(() => ID)
    connectionId!: string

    /** Its provider. */
    @Field()
    provider!: string

    /** The account as people read it ("Tiệm hoa NIVO", "MB Bank •••• 5252"). */
    @Field()
    accountLabel!: string

    /** The ability ticked on it that holds the tool. */
    @Field()
    ability!: string

    /** `auto` runs by itself, `ask` waits for a person each time. */
    @Field()
    mode!: string
}

@ObjectType()
/** One tool an agent can call, in the shop's words. */
export class AgentToolType {
    /** The tool id. */
    @Field()
    id!: string

    /** Its name. */
    @Field(() => AgentToolTextType)
    title!: AgentToolTextType

    /** What it lets the agent do, one line. */
    @Field(() => AgentToolTextType)
    summary!: AgentToolTextType

    /** `acts` (changes something or says something) or `reads`. */
    @Field()
    kind!: string

    /** `declared` by the agent's module, `ability` from a ticked ability on an attached account, or `default-read`. */
    @Field()
    origin!: string

    /** The owner's grant row when it restricts the tool (`ask` or `never`); null when none does. */
    @Field(() => String, { nullable: true })
    grant!: string | null

    /** For a provider tool, the attached accounts whose ticked ability holds it; empty otherwise. */
    @Field(() => [AgentToolAccountType])
    accounts!: Array<AgentToolAccountType>

    /** False when the agent cannot call it now (forbidden, or a provider tool no attached account ticks). */
    @Field()
    ready!: boolean
}
