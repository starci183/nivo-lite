import type { IntentCheckKey } from "./intent-contracts.contracts"
import type { OptionalCheckKey } from "./intent-policies.contracts"

/** The longest customer reply the check `reply_bounded` lets through: a few times the 80 words the contract asks for. */
export const REPLY_CHECK_MAX = 1500

/** What a check reads: the intent that was picked and its result as the schema parsed it. */
export interface CheckInput {
    /** The intent picked. */
    readonly intent: string
    /** The result. */
    readonly result: Readonly<Record<string, unknown>>
}

/** A check answers true when the result passes. */
type Check = (input: CheckInput) => boolean

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== ""

/** A member that is absent passes: only a member that is there is held to its shape. */
const whenSet =
    (member: string, test: (value: Readonly<Record<string, unknown>>) => boolean): Check =>
    ({ result }) => {
        const value = result[member]
        return !isRecord(value) || test(value)
    }

/** The checks of a result, by key: pure functions of the parsed result, so a new check is one more entry. */
export const INTENT_CHECKS: Readonly<Record<IntentCheckKey, Check>> = {
    reply_present: ({ result }) => filled(result.reply),
    reply_bounded: ({ result }) => typeof result.reply === "string" && result.reply.length <= REPLY_CHECK_MAX,
    lead_complete: whenSet("lead", (lead) => filled(lead.contact_name) && filled(lead.need)),
    order_complete: whenSet("order", (order) => filled(order.items) && typeof order.amount_vnd === "number"),
    order_price_known: whenSet("order", (order) => typeof order.amount_vnd === "number" && order.amount_vnd > 0),
    action_is_intent: ({ intent, result }) => result.action === intent,
    action_has_summary: ({ result }) => filled(result.summary),
}

/** True when the result passes the check of that key. */
export const checkResult = (key: IntentCheckKey, input: CheckInput): boolean => INTENT_CHECKS[key](input)

/** The first check of the list the result fails, or null when it passes them all. */
export const failedCheckOf = (keys: ReadonlyArray<IntentCheckKey>, input: CheckInput): OptionalCheckKey =>
    keys.find((key) => !checkResult(key, input)) ?? null
