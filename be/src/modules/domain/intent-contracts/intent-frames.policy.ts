import type { IntentFrame, IntentTrigger } from "./intent-contracts.contracts"
import type { FrameAction, OptionalIntentFrame } from "./intent-policies.contracts"

/** The intents that write through a tool and so run in a turn of their own. */
const WRITE_INTENTS: ReadonlySet<string> = new Set(["gateway_call"])

const LEAD_RULE = "intentContracts.limit.lead"
const ORDER_RULE = "intentContracts.limit.order"

/** The rules of the customer reply, in the order the legacy reply contract states them. */
const CUSTOMER_RULES: ReadonlyArray<string> = [
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

/** The member of the customer result each limit is about: a limit whose member another intent owns is left out of this one. */
export const LIMIT_MEMBERS: Readonly<Record<string, string>> = {
    [LEAD_RULE]: "lead",
    [ORDER_RULE]: "order",
    "intentContracts.limit.booking": "booking_request",
    "intentContracts.limit.loyalty": "loyalty",
    "intentContracts.limit.application": "application",
}

const customerFrame = (
    intent: string,
    taskKey: string,
    owns: ReadonlyArray<string>,
    extra: ReadonlyArray<string>,
    risk: IntentFrame["risk"] = "none",
): IntentFrame => ({
    intent,
    triggers: ["customer_message"],
    risk,
    taskKey,
    limitKeys: { customer: [...CUSTOMER_RULES, ...extra] },
    result: "customer_reply",
    owns,
    checks: ["reply_present", "reply_bounded", "lead_complete", "order_complete", "order_price_known"],
})

/**
 * The reply family: the intents of a customer turn, each with its own words. A member of the customer result that one of them owns is
 * dropped from the others when the graph holds the owner, and stays allowed on `reply_customer` when it does not.
 */
const REPLY_FAMILY: ReadonlyArray<IntentFrame> = [
    customerFrame("reply_customer", "intentContracts.task.reply_customer", [], []),
    customerFrame("handoff_lead", "intentContracts.task.handoff_lead", ["lead"], []),
    customerFrame("confirm_order", "intentContracts.task.confirm_order", ["order"], []),
    customerFrame("gateway_call", "intentContracts.task.gateway_call", [], [], "write"),
    customerFrame(
        "confirm_booking",
        "intentContracts.task.confirm_booking",
        ["booking_request"],
        ["intentContracts.limit.booking"],
    ),
    customerFrame(
        "redeem_reward",
        "intentContracts.task.redeem_reward",
        ["loyalty"],
        ["intentContracts.limit.loyalty"],
    ),
    customerFrame(
        "screen_candidate",
        "intentContracts.task.screen_candidate",
        ["application"],
        ["intentContracts.limit.application"],
    ),
]

const REQUEST_LIMITS: ReadonlyArray<string> = [
    "intentContracts.limit.reply_internal",
    "intentContracts.limit.tasks",
    "intentContracts.limit.task_title",
    "intentContracts.limit.request_only",
]

/** An amount that limits an action makes it money; a write through a tool makes it write. */
const riskOf = (action: FrameAction): IntentFrame["risk"] => {
    if (action.amountLimit) return "money"
    return WRITE_INTENTS.has(action.action) ? "write" : "none"
}

/** Any catalogue action asked for by a tag: a request the system decides on, never something done. */
const requestFrame = (action: FrameAction): IntentFrame => ({
    intent: action.action,
    triggers: ["tag"],
    risk: riskOf(action),
    taskKey: "intentContracts.task.agent_request",
    limitKeys: { manager: REQUEST_LIMITS, staff: ["intentContracts.limit.staff"] },
    result: "agent_request",
    owns: [],
    checks: ["action_is_intent", "action_has_summary"],
})

/** The intents that have a frame of their own for a customer message. */
export const REPLY_INTENTS: ReadonlyArray<string> = REPLY_FAMILY.map((frame) => frame.intent)

/**
 * The frame an intent runs under for a trigger, or null when it has none. A customer message runs only the reply family. Every
 * catalogue action of the module can be asked for by a tag, from the one generic request frame, so an intent that is not in the
 * catalogue has no frame at all.
 */
export const frameOfIntent = (
    intent: string,
    actions: ReadonlyArray<FrameAction>,
    trigger: IntentTrigger,
): OptionalIntentFrame => {
    if (trigger === "customer_message") {
        return REPLY_FAMILY.find((frame) => frame.intent === intent && actions.some((a) => a.action === intent)) ?? null
    }
    const action = actions.find((entry) => entry.action === intent)
    return action === undefined ? null : requestFrame(action)
}
