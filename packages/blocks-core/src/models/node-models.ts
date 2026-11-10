import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { AUTO_MODEL, SONNET_MODEL, isModelChoice, isRetiredModel } from "./models"
import type { ModelChoice, StepWeight } from "./models"

/** What blocks-core declares for one node that calls AI: the model its calls use, and how much its step weighs (Auto reads it). */
export interface NodeModel {
    /** `auto`, or an explicit model id. */
    readonly model: ModelChoice
    /** Light (classify, route, a short reply) or heavy (a money decision, a money record, a report). */
    readonly weight: StepWeight
}

/**
 * TEMPORARY switch (owner, 2026-11-11: "tạm sửa auto = claude trong blocks-core, tại có 200 USD credit"): while true, EVERY AI node
 * (every row of `NODE_MODELS` and `ENGINE_CORE_MODEL`) declares Claude Sonnet 5.5 instead of Auto, to spend the Anthropic credit.
 * Weights are untouched. Set it to false to return to Auto exactly (then blocks-core build + `npm run seeds:graphs`).
 */
export const ALL_NODES_ON_CLAUDE: boolean = true

const light: NodeModel = { model: AUTO_MODEL, weight: "light" }
const heavy: NodeModel = { model: AUTO_MODEL, weight: "heavy" }

/** A row as the switch declares it: Sonnet when every node is on Claude, the row as written (Auto) otherwise; weight kept. */
const underSwitch = (row: NodeModel, allOnClaude: boolean): NodeModel => (allOnClaude ? { ...row, model: SONNET_MODEL } : row)

/** The table as written: every AI node on Auto, with its weight. The exported `NODE_MODELS` applies the switch above to it. */
const AUTO_NODE_MODELS: Readonly<Record<string, NodeModel>> = {
    // Understanding and routing a customer's words: classification.
    "chatbot.understand": light,
    // Short replies to a customer from the shop's knowledge, or a complaint taken down and passed on.
    "chatbot.answer": light,
    "chatbot.complaint": light,
    // The sales conversation: replies and a lead; no money is written by it.
    "sales.consult-turn": light,
    // The order is written with its amount and confirmed: money.
    "sales.create-order": heavy,
    // Notices and care lines, to the team or to a customer.
    "sales.order-notice": light,
    "sales.web-order": light,
    "sales.after-sale": light,
    "sales.care-plan": light,
    "sales.care-delivery-check": light,
    "sales.care-occasion": light,
    "sales.payment-reminder": light,
    "sales.unpaid-notice": light,
    "payment.received-notice": light,
    // The payment request names an amount on a QR code: money.
    "payment.request": heavy,
    // Settling an order, matching a transfer to an order, posting to the ledger: money decisions.
    "payment.settle": heavy,
    "accounting.match-payment": heavy,
    "accounting.post-payment": heavy,
    // The daily close report.
    "accounting.report": heavy,
    // A colleague's answer to the team in the internal chat (truth reads, at most a proposal the owner decides): a short reply.
    "team.chat": light,
}

/** The table under either position of the switch (the spec reads both); `NODE_MODELS` is it under `ALL_NODES_ON_CLAUDE`. */
export const nodeModelsUnder = (allOnClaude: boolean): Readonly<Record<string, NodeModel>> =>
    Object.fromEntries(Object.entries(AUTO_NODE_MODELS).map(([id, row]) => [id, underSwitch(row, allOnClaude)]))

/**
 * ONE table, node id → its model and weight, for every node that calls AI (a spec proves every such node has a row). The node files
 * do not carry it, so this is the one place a model or a weight changes. A node that calls no AI has no row.
 */
export const NODE_MODELS: Readonly<Record<string, NodeModel>> = nodeModelsUnder(ALL_NODES_ON_CLAUDE)

/**
 * The engine's own decision on a step that could not complete (the AI core): what it decides is a report to the founder, so it
 * weighs like a report.
 */
export const ENGINE_CORE_MODEL: NodeModel = underSwitch(heavy, ALL_NODES_ON_CLAUDE)

/** The declaration of a node, or null for a node that calls no AI (or is unknown). */
export const nodeModelOf = (nodeId: string): NodeModel | null => NODE_MODELS[nodeId] ?? null

/** One problem of the models a graph names. */
export interface GraphModelProblem {
    /**
     * `MODEL_RETIRED`: a retired model (DeepSeek flash): a stored graph still runs with it, a save refuses it; `MODEL_UNKNOWN`: not
     * Auto and not a model of the vocabulary; `MODEL_ON_NODE_WITHOUT_AI`: the node's step calls no AI.
     */
    readonly code: "MODEL_RETIRED" | "MODEL_UNKNOWN" | "MODEL_ON_NODE_WITHOUT_AI"
    /** The node's key. */
    readonly nodeKey: string
}

/** The problems of the models a graph names, for the save of a graph (the node drawer's model picker). None for a graph that names none. */
export const graphModelProblems = (spec: Pick<GraphSpec, "nodes">): ReadonlyArray<GraphModelProblem> =>
    spec.nodes.flatMap((node): ReadonlyArray<GraphModelProblem> => {
        if (node.model === undefined) return []
        if (isRetiredModel(node.model)) return [{ code: "MODEL_RETIRED", nodeKey: node.key }]
        if (!isModelChoice(node.model)) return [{ code: "MODEL_UNKNOWN", nodeKey: node.key }]
        return nodeModelOf(node.step) === null ? [{ code: "MODEL_ON_NODE_WITHOUT_AI", nodeKey: node.key }] : []
    })

/** The node with its step's declared model when it names none and its step calls AI; any other node as it is. */
const withDeclaredModel = (node: GraphSpecNode): GraphSpecNode => {
    const declared = nodeModelOf(node.step)
    return node.model !== undefined || declared === null ? node : { ...node, model: declared.model }
}

/**
 * The graph with the declared model written on every node that calls AI and names none: how blocks-core's declaration travels into
 * a template's graph, the seed made from it and every shop's copy, where the shop may then change it per node.
 */
export const withDeclaredModels = <G extends Pick<GraphSpec, "nodes">>(graph: G): G => ({
    ...graph,
    nodes: graph.nodes.map(withDeclaredModel),
})
