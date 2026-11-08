import type { AgentPluginManifest } from "@modules/domain/agent-plugins"
import { type IntentCheck, type IntentFrame, requestFrameOf } from "@modules/domain/intent-contracts"
import { customerReplySchema } from "./customer-intents.schema"

/** The kind of result a customer turn answers, and the checks it passes. */
const REPLY_RESULT = "customer_reply"

/** The longest customer reply the check `reply_bounded` lets through: a few times the 80 words the contract asks for. */
export const REPLY_CHECK_MAX = 1500

const LEAD_RULE = "intentContracts.limit.lead"
const ORDER_RULE = "intentContracts.limit.order"
const BOOKING_RULE = "intentContracts.limit.booking"
const LOYALTY_RULE = "intentContracts.limit.loyalty"
const APPLICATION_RULE = "intentContracts.limit.application"

/** The rules of the customer reply, in the order the reply contract states them. */
const REPLY_RULES: ReadonlyArray<string> = [
    "intentContracts.limit.reply_style",
    LEAD_RULE,
    "intentContracts.limit.authority",
    "intentContracts.limit.routine",
    "intentContracts.limit.otherwise",
    ORDER_RULE,
    "intentContracts.limit.payment_claim",
    "intentContracts.limit.knowledge_gap",
    "intentContracts.limit.proposal",
]

/** The member of the reply each rule is about: a rule whose member another offered intent owns is left out of this one. */
const RULE_MEMBERS: Readonly<Record<string, string>> = {
    [LEAD_RULE]: "lead",
    [ORDER_RULE]: "order",
    [BOOKING_RULE]: "booking_request",
    [LOYALTY_RULE]: "loyalty",
    [APPLICATION_RULE]: "application",
}

const replyFrame = (
    intent: string,
    taskKey: string,
    owns: ReadonlyArray<string>,
    extra: ReadonlyArray<string>,
    ownTurn = false,
    answers = false,
): IntentFrame => ({
    intent,
    triggers: ["customer_message"],
    ownTurn,
    answers,
    taskKey,
    limitKeys: { outsider: [...REPLY_RULES, ...extra] },
    result: REPLY_RESULT,
    owns,
    limitMembers: RULE_MEMBERS,
    checks: ["reply_present", "reply_bounded", "lead_complete", "order_complete", "order_price_known"],
})

/**
 * The customer-message frames of the Sales intents its published graph reaches besides the order: each is a customer reply worded for its
 * own task, owning no member, so the lead and the reply rules stay on every one of them and the order stays with `confirm_order`. Frames
 * are data a domain registers; their future home is the agent SDK (`@nivo-lite/agent-sdk`, contract frames registered per domain), where
 * the Sales domain registers this list and the core holds no domain words.
 */
const SALES_CUSTOMER_FRAMES: ReadonlyArray<IntentFrame> = [
    "classify_lead",
    "send_follow_up",
    "send_quote",
    "send_care",
    "give_discount",
].map((intent) => replyFrame(intent, `intentContracts.task.${intent}`, [], [], false, true))

/**
 * The intents of a customer turn, each with its own words. A member of the reply that one of them owns is dropped from the others when
 * the graph holds the owner, and stays allowed on `reply_customer` when it does not. A write through the tools runs in a turn of its own,
 * for a customer message and for a tag alike.
 */
const CUSTOMER_FRAMES: ReadonlyArray<IntentFrame> = [
    replyFrame("reply_customer", "intentContracts.task.reply_customer", [], [], false, true),
    replyFrame("handoff_lead", "intentContracts.task.handoff_lead", ["lead"], []),
    replyFrame("confirm_order", "intentContracts.task.confirm_order", ["order"], []),
    replyFrame("gateway_call", "intentContracts.task.gateway_call", [], [], true),
    replyFrame("confirm_booking", "intentContracts.task.confirm_booking", ["booking_request"], [BOOKING_RULE]),
    replyFrame("redeem_reward", "intentContracts.task.redeem_reward", ["loyalty"], [LOYALTY_RULE]),
    replyFrame("screen_candidate", "intentContracts.task.screen_candidate", ["application"], [APPLICATION_RULE]),
    requestFrameOf("gateway_call", true),
    ...SALES_CUSTOMER_FRAMES,
]

const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== ""

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A member that is absent passes: only a member that is there is held to its shape. */
const whenSet =
    (member: string, test: (value: Readonly<Record<string, unknown>>) => boolean): IntentCheck =>
    ({ result }) => {
        const value = result[member]
        return !isRecord(value) || test(value)
    }

/** The checks of a customer reply: pure functions of the parsed result. */
const CUSTOMER_CHECKS: Readonly<Record<string, IntentCheck>> = {
    reply_present: ({ result }) => filled(result.reply),
    reply_bounded: ({ result }) => typeof result.reply === "string" && result.reply.length <= REPLY_CHECK_MAX,
    lead_complete: whenSet("lead", (lead) => filled(lead.contact_name) && filled(lead.need)),
    order_complete: whenSet("order", (order) => filled(order.items) && typeof order.amount_vnd === "number"),
    order_price_known: whenSet("order", (order) => typeof order.amount_vnd === "number" && order.amount_vnd > 0),
}

/** The customer reply as a plug-in: its frames, its one kind of result and its checks. */
export const CUSTOMER_PLUGIN: AgentPluginManifest = {
    key: "customer",
    contracts: CUSTOMER_FRAMES,
    results: { [REPLY_RESULT]: customerReplySchema },
    checks: CUSTOMER_CHECKS,
}
