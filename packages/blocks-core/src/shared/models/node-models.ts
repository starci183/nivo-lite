import { AUTO_MODEL } from "./models"
import { ALL_NODES_ON_CLAUDE, underSwitch, type NodeModel } from "@nivo-lite/agent-sdk/models"

export { ALL_NODES_ON_CLAUDE, ENGINE_CORE_MODEL } from "@nivo-lite/agent-sdk/models"
export type { NodeModel, NodeWorkKind } from "@nivo-lite/agent-sdk/models"

/**
 * The output bound of a short answer to a person (the consult's turn, a colleague's chat answer): one message and at most one tool
 * call per turn. Measured on dev (P11, 2026-11-11): 311 to 1,043 completion tokens with reasoning; a runaway try wrote 22,071
 * characters (about 7,000 tokens, 72 s) before the app's cap cut it. Bounded here, the same runaway costs about 1,200 tokens.
 */
const SHORT_ANSWER_MAX_TOKENS = 1200

const light: NodeModel = { model: AUTO_MODEL, weight: "light" }

/** The table as written: every AI node on Auto, with its weight. The exported `NODE_MODELS` applies the switch above to it. */
const AUTO_NODE_MODELS: Readonly<Record<string, NodeModel>> = {
    // Understanding and routing a customer's words: classification.
    "chatbot.understand": light,
    // Short replies to a customer from the shop's knowledge; a complaint answered, then passed on to the team.
    "chatbot.answer": light,
    "chatbot.complaint-reply": light,
    "chatbot.complaint-notify": light,
    // The sales conversation: replies and a lead; no money is written by it. A turn is one short answer, as is the cancel line.
    "sales.consult-turn": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    // A customer's message while the order waits for its money: the model decides by meaning whether it is about the order, then answers it in one short line.
    "sales.order-talk": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "sales.order-cancel-tell": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "sales.cancel-paid-notice": light,
    // The order told to the customer (its code, lines, total, how to pay as the truths state it), the payment reminder, the answer to
    // a customer who says they paid: one short line each.
    "sales.order-tell": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "sales.payment-remind": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "sales.paid-claim-reply": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "sales.payment-short": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    // Care lines and notices, to the team or to a customer, and the readings that arm them.
    "sales.after-sale": light,
    "sales.care-plan-delivery": light,
    "sales.care-delivery-check": light,
    "sales.care-occasion": light,
    "sales.web-order-keep": light,
    "sales.web-order-notice": light,
    // A colleague's answer to the team in the internal chat (truth reads, at most a proposal the owner decides): a short reply.
    "team.chat": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS, work: "chat_turn" },
    // Bookings: a short reply that settles a customer's service and slot, the confirmation lines to the customer and the team, a reminder line.
    "booking.book": { ...light, maxOutputTokens: SHORT_ANSWER_MAX_TOKENS },
    "booking.confirm-tell": light,
    "booking.remind": light,
    // Hiring: an advisory screening summary, an interview invitation a person approves, the morning digest.
    "hiring.screen": light,
    "hiring.invite": light,
    "hiring.digest": light,
    // Writing a short video's script from the shop's truths: one structured answer after a few brain reads.
    "video.script": light,
    // Content: the month's post ideas on settled slots, and one post's words for its channel, each after a few brain reads.
    "content.plan": light,
    "content.draft": light,
}

/** The table under either position of the switch (the spec reads both); `NODE_MODELS` is it under `ALL_NODES_ON_CLAUDE`. */
export const nodeModelsUnder = (allOnClaude: boolean): Readonly<Record<string, NodeModel>> =>
    Object.fromEntries(Object.entries(AUTO_NODE_MODELS).map(([id, row]) => [id, underSwitch(row, allOnClaude)]))

/**
 * ONE table, node id -> its model and weight, for every node that calls AI (a spec proves every such node has a row). The node files
 * do not carry it, so this is the one place a model or a weight changes. A node that calls no AI has no row.
 */
export const NODE_MODELS: Readonly<Record<string, NodeModel>> = nodeModelsUnder(ALL_NODES_ON_CLAUDE)

/** The declaration of a node, or null for a node that calls no AI (or is unknown). */
export const nodeModelOf = (nodeId: string): NodeModel | null => NODE_MODELS[nodeId] ?? null
