import type { AgentGraphWire } from "@modules/domain/agent-graphs"

/** One AI node of the graph: its declared model and its model use over the last days (owner: "model, credits tren tung node"). */
export interface AgentGraphAiNode {
    /** The graph node's key (the run step key). */
    readonly nodeKey: string
    /** The blocks-core node it runs (`accounting.match-payment`). */
    readonly nodeId: string
    /** The model its calls are declared with: `auto` or a model id. */
    readonly declaredModel: string
    /** Where it comes from: `node` (the shop's choice), `declared` (blocks-core's table), `default`. */
    readonly modelSource: string
    /** The step's weight (`light` | `heavy`), blocks-core's. */
    readonly weight: string
    /** Runs that called a model in this node over the window. */
    readonly runs: number
    /** Answered calls. */
    readonly calls: number
    /** Failed tries (estimated, never billed). */
    readonly failedTries: number
    /** The exact cost of the answers in USD. */
    readonly costUsd: number
    /** The credits of the answers, an exact fraction. */
    readonly credits: number
    /** The credits of one run on average, an exact fraction. */
    readonly creditsPerRun: number
    /** The price of the failed tries in USD. */
    readonly failedCostUsd: number
    /** The average time of an answered call, milliseconds; null when none was measured. */
    readonly averageMs: number | null
    /** The models that served the calls, sorted. */
    readonly servedModels: ReadonlyArray<string>
}

/** The graph for the editor with the model use of each AI node over the last 7 days. */
export type AgentGraphRead = AgentGraphWire & {
    /** The AI nodes of the draft, in the draft's order. */
    readonly aiNodes: ReadonlyArray<AgentGraphAiNode>
    /** The window the figures cover, in days. */
    readonly aiWindowDays: number
}
