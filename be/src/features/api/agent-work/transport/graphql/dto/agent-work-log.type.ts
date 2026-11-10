import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The connection a piece of work went through. */
export class AgentWorkLogConnectionType {
    /** The connection. */
    @Field(() => ID)
    id!: string

    /** Its display name. */
    @Field()
    name!: string

    /** Its provider key. */
    @Field()
    provider!: string
}

@ObjectType()
/** One thing the work knew when it acted. */
export class AgentWorkLogEvidenceType {
    /** What it is about. */
    @Field()
    key!: string

    /** The value, as text. */
    @Field()
    value!: string
}

@ObjectType()
/** One step of a piece of work. */
export class AgentWorkLogStepType {
    /** raised, gate, decided or closed. */
    @Field()
    key!: string

    /** When it happened, ISO 8601, or null when the record holds no moment for it. */
    @Field(() => String, { nullable: true })
    at!: string | null

    /** done, current or failed. */
    @Field()
    state!: string
}

@ObjectType()
/** One line of the work log of an agent. */
export class AgentWorkLogLineType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** The action key. */
    @Field()
    action!: string

    /** When the work finished, or else when it was raised, ISO 8601. */
    @Field()
    at!: string

    /** What was done, or what is proposed. */
    @Field()
    title!: string

    /** The proposal's own sentence when it differs from the title. */
    @Field()
    detail!: string

    /** queued, waiting, done, rejected or failed. */
    @Field()
    status!: string

    /** auto when the agent did it alone, ask when a person decided; null while nobody has. */
    @Field(() => String, { nullable: true })
    level!: string | null

    /** The connection it went through, or null. */
    @Field(() => AgentWorkLogConnectionType, { nullable: true })
    connection!: AgentWorkLogConnectionType | null

    /** The kind of record the work is about. */
    @Field()
    evidenceKind!: string

    /** The code that ties the work to its record, or null. */
    @Field(() => String, { nullable: true })
    evidenceCode!: string | null

    /** What the proposal carried as evidence. */
    @Field(() => [AgentWorkLogEvidenceType])
    evidence!: Array<AgentWorkLogEvidenceType>

    /** Why the gate asked a person, or null. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The steps the record tells. */
    @Field(() => [AgentWorkLogStepType])
    steps!: Array<AgentWorkLogStepType>

    /** Where the owner can see the result, or null. */
    @Field(() => String, { nullable: true })
    resultHref!: string | null

    /** The failure, or null. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
