import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"
import { AgentRunDecisionType } from "./agent-run-decision.type"
import { AgentRunRowType } from "./agent-run.type"

@ObjectType()
/** One plain fact of what a step was given or stored. */
export class AgentRunFactType {
    /** What it is. */
    @Field()
    key!: string

    /** Its value, as text. */
    @Field()
    value!: string
}

@ObjectType()
/** One door call a step made. */
export class AgentRunCallType {
    /** The tool. */
    @Field()
    tool!: string

    /** Whether it worked. */
    @Field()
    ok!: boolean

    /** Why it failed, or null. */
    @Field(() => String, { nullable: true })
    failure!: string | null
}

@ObjectType()
/** One step of a run. */
export class AgentRunStepType {
    /** Unique within the run. */
    @Field()
    stepKey!: string

    /** The node of the graph it is. */
    @Field()
    nodeKey!: string

    /** The place in the run, from one. */
    @Field(() => Int)
    ordinal!: number

    /** pending, running, waiting, done or failed. */
    @Field()
    status!: string

    /** The tries made. */
    @Field(() => Int)
    attempt!: number

    /** The tries it gets. */
    @Field(() => Int)
    maxAttempts!: number

    /** When it began, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    startedAt!: string | null

    /** How long it took, milliseconds, or null. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null

    /** Why it last failed, or null. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The work item it waits on or is about, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** What it was given. */
    @Field(() => [AgentRunFactType])
    input!: ReadonlyArray<AgentRunFactType>

    /** What it stored. */
    @Field(() => [AgentRunFactType])
    output!: ReadonlyArray<AgentRunFactType>

    /** The door calls it made. */
    @Field(() => [AgentRunCallType])
    calls!: ReadonlyArray<AgentRunCallType>
}

@ObjectType()
/** The work item a run is about. */
export class AgentRunItemType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** Its action key. */
    @Field()
    action!: string

    /** What it proposes, or did. */
    @Field()
    summary!: string

    /** queued, waiting_decision, done, rejected or failed. */
    @Field()
    status!: string

    /** Why the gate asked a person, or null. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** What the proposal carried as evidence. */
    @Field(() => [AgentRunFactType])
    evidence!: ReadonlyArray<AgentRunFactType>

    /** The failure, or null. */
    @Field(() => String, { nullable: true })
    error!: string | null
}

@ObjectType()
/** The model calls of a run of one call kind, summed. */
export class AgentRunAiCallType {
    /** The run step (graph node key) the calls were made in; null for a call booked without one (before U1, or outside a node). */
    @Field(() => String, { nullable: true })
    stepKey!: string | null

    /**
     * The words of the call kind in the reader's language, from blocks-core (a node's call by its step's title, the engine's own call
     * by its words); null when blocks-core has none (the page then uses its own words, never the raw kind).
     */
    @Field(() => String, { nullable: true })
    label!: string | null

    /** Every try booked: the answers and the failed tries (the "tries" column). */
    @Field(() => Int)
    tries!: number

    /** The failed tries (timeout, provider error, cut, empty, not JSON), booked estimated and never billed (the "retries" column). */
    @Field(() => Int)
    failedTries!: number

    /** Prompt tokens of the answers written to the provider's prompt cache. */
    @Field(() => Int)
    cacheWriteTokens!: number

    /** Prompt tokens the app counted for the failed tries (no output). */
    @Field(() => Int)
    failedPromptTokens!: number

    /** The price of the failed tries in USD (estimated; not billed). */
    @Field(() => Float)
    failedCostUsd!: number

    /** The credits of the answers, an exact fraction (never rounded per call). */
    @Field(() => Float)
    credits!: number

    /** The credits of the failed tries, an exact fraction (estimated; not billed). */
    @Field(() => Float)
    failedCredits!: number

    /** The failure codes of the failed tries, sorted, without repeats. */
    @Field(() => [String])
    failures!: ReadonlyArray<string>

    /** The kinds of work the calls served (`node`, `engine_core`), sorted, without repeats. */
    @Field(() => [String])
    workKinds!: ReadonlyArray<string>

    /** The call kind: a node's `<node id>:<tag>` (`accounting.match-payment:agent`), or the usage kind of a fixed task. */
    @Field()
    purpose!: string

    /** The calls of this kind that answered (a failed try is never booked). */
    @Field(() => Int)
    calls!: number

    /** The highest try number among them (above 1: a try failed before one answered); null when not recorded. */
    @Field(() => Int, { nullable: true })
    maxTry!: number | null

    /** Prompt tokens of all the calls, cached ones included. */
    @Field(() => Int)
    promptTokens!: number

    /** Prompt tokens served from the provider's prompt cache. */
    @Field(() => Int)
    cachedTokens!: number

    /** Completion tokens, reasoning included. */
    @Field(() => Int)
    completionTokens!: number

    /** The part of the completion tokens that was hidden reasoning. */
    @Field(() => Int)
    reasoningTokens!: number

    /** The wall time of all the calls together, milliseconds. */
    @Field(() => Int)
    durationMs!: number

    /** The slowest call, milliseconds; null when none was measured. */
    @Field(() => Int, { nullable: true })
    slowestMs!: number | null

    /** The cost of the calls in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The upstreams that served them, sorted, without repeats. */
    @Field(() => [String])
    upstreams!: ReadonlyArray<string>

    /** Why the model stopped, sorted, without repeats. */
    @Field(() => [String])
    finishReasons!: ReadonlyArray<string>

    /** The models that served the calls, sorted, without repeats. */
    @Field(() => [String])
    models!: ReadonlyArray<string>

    /** What the node declared (`auto` or a model id), sorted, without repeats; empty for a fixed task. */
    @Field(() => [String])
    declaredModels!: ReadonlyArray<string>

    /** The providers of the models that served them, sorted, without repeats. */
    @Field(() => [String])
    modelProviders!: ReadonlyArray<string>

    /** Why the calls went to those models, sorted, without repeats. */
    @Field(() => [String])
    modelReasons!: ReadonlyArray<string>
}

@ObjectType()
/** The model use of a whole run: exact USD and exact credits (fractions), the failed tries apart. */
export class AgentRunAiTotalsType {
    /** Answered calls. */
    @Field(() => Int)
    calls!: number

    /** Every try, the failed ones included. */
    @Field(() => Int)
    tries!: number

    /** Failed tries (estimated, never billed). */
    @Field(() => Int)
    failedTries!: number

    /** Prompt tokens of the answers. */
    @Field(() => Int)
    promptTokens!: number

    /** Of them, read from the provider's prompt cache. */
    @Field(() => Int)
    cachedTokens!: number

    /** Of them, written to the provider's prompt cache. */
    @Field(() => Int)
    cacheWriteTokens!: number

    /** Completion tokens of the answers. */
    @Field(() => Int)
    completionTokens!: number

    /** Of them, hidden reasoning. */
    @Field(() => Int)
    reasoningTokens!: number

    /** The exact cost of the answers in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The credits of the answers, an exact fraction. */
    @Field(() => Float)
    credits!: number

    /** The price of the failed tries in USD (estimated; not billed). */
    @Field(() => Float)
    failedCostUsd!: number

    /** The credits of the failed tries, an exact fraction. */
    @Field(() => Float)
    failedCredits!: number
}

@ObjectType()
/** One truth a read of the truth graph served during a run: the fact and the version the agent read. */
export class AgentRunTruthFactType {
    /** The fact. */
    @Field(() => ID)
    factId!: string

    /** Its version when it was read, or null when the store never numbered it. */
    @Field(() => Int, { nullable: true })
    version!: number | null
}

@ObjectType()
/** One read of the truth graph a run's agent made (the "read" list): the tool, when, and the truths it served, in answer order. */
export class AgentRunTruthReadType {
    /** The full tool name (`nivo.tool.brain.search`, `nivo.tool.brain.fact.get`...). */
    @Field()
    tool!: string

    /** When it read, ISO 8601. */
    @Field()
    at!: string

    /** The truths it served. */
    @Field(() => [AgentRunTruthFactType])
    facts!: ReadonlyArray<AgentRunTruthFactType>
}

@ObjectType()
/** One run with its steps and the work item it is about. */
export class AgentRunDetailType {
    /** The run as the list draws it. */
    @Field(() => AgentRunRowType)
    row!: AgentRunRowType

    /** The steps in order. */
    @Field(() => [AgentRunStepType])
    steps!: ReadonlyArray<AgentRunStepType>

    /** The work item the run is about, or null. */
    @Field(() => AgentRunItemType, { nullable: true })
    item!: AgentRunItemType | null

    /** Whether the run may be run again from its failed step. */
    @Field()
    canResume!: boolean

    /** Whether the run is queued, running or waiting and may be cancelled. */
    @Field()
    canCancel!: boolean

    /** The decision the run waits on, or null when it waits on none. */
    @Field(() => AgentRunDecisionType, { nullable: true })
    decision!: AgentRunDecisionType | null

    /** Its model calls per step and call kind, in the order of their first call. */
    @Field(() => [AgentRunAiCallType])
    aiCalls!: ReadonlyArray<AgentRunAiCallType>

    /** The run's model use in total. */
    @Field(() => AgentRunAiTotalsType)
    aiTotals!: AgentRunAiTotalsType

    /** What the run's agents read of the truth graph, oldest first; empty when none (or before the record existed). */
    @Field(() => [AgentRunTruthReadType])
    truthReads!: ReadonlyArray<AgentRunTruthReadType>
}
