import type { IntentCheck, IntentDomain, IntentFrame } from "@modules/domain/intent-contracts"
import { requestFrameOf } from "@modules/domain/intent-contracts"
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

/** The rules of the customer reply, in the order the legacy reply contract states them. */
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

/** The customer reply as a domain of the registry: its frames, its one kind of result and its checks. */
export const CUSTOMER_INTENT_DOMAIN: IntentDomain = {
    frames: CUSTOMER_FRAMES,
    results: { [REPLY_RESULT]: customerReplySchema },
    checks: CUSTOMER_CHECKS,
}
