import { AUTO_MODEL, SONNET_MODEL, type ModelChoice, type StepWeight } from "./models"

/** The kinds of work a node's calls may be booked as instead of plain node work: a person's message in the team chat, answered. */
export type NodeWorkKind = "chat_turn"

/**
 * What a plugin declares for one node that calls AI: the model its calls use, how much its step weighs (Auto reads it), and,
 * where the node's answer has a known size, the most completion tokens one call may produce and the work its calls are booked as.
 */
export interface NodeModel {
    /** `auto`, or an explicit model id. */
    readonly model: ModelChoice
    /** Light (classify, route, a short reply) or heavy (a money decision, a money record, a report). */
    readonly weight: StepWeight
    /**
     * The most completion tokens ONE call of the node may produce, reasoning included: a bound on a runaway answer, never the size of
     * a normal one (set well above it). Absent: the app's cap of node calls. The smaller of the two is sent.
     */
    readonly maxOutputTokens?: number
    /** The work the node's calls are booked as (`chat_turn`: an answer to a person's message in the team chat); absent: node work. */
    readonly work?: NodeWorkKind
}

/**
 * TEMPORARY switch (owner, 2026-11-11: "for now set auto = claude, since there is 200 USD of credit"): while true, EVERY AI node
 * (every row of a plugin's table of node models and `ENGINE_CORE_MODEL`) declares Claude Sonnet 5.5 instead of Auto, to spend the
 * Anthropic credit. Weights are untouched. Set it to false to return to Auto exactly (then package builds + `npm run seeds:graphs`).
 */
export const ALL_NODES_ON_CLAUDE: boolean = true

/** A row as the switch declares it: Sonnet when every node is on Claude, the row as written (Auto) otherwise; weight kept. */
export const underSwitch = (row: NodeModel, allOnClaude: boolean): NodeModel =>
    allOnClaude ? { ...row, model: SONNET_MODEL } : row

/**
 * The engine's own decision on a step that could not complete (the AI core): what it decides is a report to the founder, so it
 * weighs like a report.
 */
export const ENGINE_CORE_MODEL: NodeModel = underSwitch({ model: AUTO_MODEL, weight: "heavy" }, ALL_NODES_ON_CLAUDE)
