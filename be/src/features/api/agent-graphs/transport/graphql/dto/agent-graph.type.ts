import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One AI node of an agent's graph: its declared model and its model use over the window (owner and manager only). */
export class AgentGraphAiNodeType {
    /** The graph node's key (the run step key). */
    @Field(() => String)
    nodeKey!: string

    /** The blocks-core node it runs. */
    @Field(() => String)
    nodeId!: string

    /** The model its calls are declared with: `auto` or a model id. */
    @Field(() => String)
    declaredModel!: string

    /** Where the model comes from: `node` (the shop's choice), `declared` (blocks-core), `default`. */
    @Field(() => String)
    modelSource!: string

    /** The step's weight: `light` or `heavy`. */
    @Field(() => String)
    weight!: string

    /** Runs that called a model in this node over the window. */
    @Field(() => Int)
    runs!: number

    /** Answered calls. */
    @Field(() => Int)
    calls!: number

    /** Failed tries (estimated, never billed). */
    @Field(() => Int)
    failedTries!: number

    /** The exact cost of the answers in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The credits of the answers over the window, an exact fraction. */
    @Field(() => Float)
    credits!: number

    /** The credits of one run on average, an exact fraction. */
    @Field(() => Float)
    creditsPerRun!: number

    /** The price of the failed tries in USD (estimated; not billed). */
    @Field(() => Float)
    failedCostUsd!: number

    /** The average time of an answered call, milliseconds; null when none was measured. */
    @Field(() => Int, { nullable: true })
    averageMs!: number | null

    /** The models that served the calls, sorted. */
    @Field(() => [String])
    servedModels!: Array<string>
}

@ObjectType()
/** The graph of one agent as the editor opens it. The graph, its problems, gaps, cards and proposals travel as JSON text. */
export class AgentGraphType {
    /** The agent. */
    @Field(() => String)
    agentId!: string

    /** The installation the agent runs as. */
    @Field(() => String)
    installationId!: string

    /** shadow records only, enforced decides. */
    @Field(() => String)
    mode!: string

    /** The revision of the draft; a save names the revision it read. */
    @Field(() => Int)
    draftRev!: number

    /** True when the draft differs from the version that decides, so there is something to publish. */
    @Field(() => Boolean)
    isDraftChanged!: boolean

    /** The version that decides, or null before the first. */
    @Field(() => String, { nullable: true })
    activeVersionId!: string | null

    /** The draft graph as JSON text: { nodes, rights }. */
    @Field(() => String)
    draftJson!: string

    /** What is still vague, in the order the setup chat asks, as JSON text. */
    @Field(() => String)
    gapsJson!: string

    /** What the owner must fix before publishing, as JSON text. */
    @Field(() => String)
    problemsJson!: string

    /** Each node as a card (id, label, description, tone, shape, count, isPlaceholder), as JSON text. */
    @Field(() => String)
    cardsJson!: string

    /** The proposals waiting for a person, as JSON text. */
    @Field(() => String)
    proposalsJson!: string

    /** The facts a condition may be written on (key, label, type, unit, allowed), as JSON text. */
    @Field(() => String)
    factsJson!: string

    /** The sums the setup text states as a rule that the graph does not hold, as JSON text. */
    @Field(() => String)
    unheldRulesJson!: string

    /** The AI nodes of the draft with their model and credits over the last days; null where the graph is answered by a write. */
    @Field(() => [AgentGraphAiNodeType], { nullable: true })
    aiNodes?: Array<AgentGraphAiNodeType> | null

    /** The days `aiNodes` covers; null with it. */
    @Field(() => Int, { nullable: true })
    aiWindowDays?: number | null
}
