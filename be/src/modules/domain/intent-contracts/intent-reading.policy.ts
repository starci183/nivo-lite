import { parseJsonText } from "@modules/platform/primitives"
import { failedCheckOf } from "./intent-check.policy"
import type { IntentContract, IntentGapText, IntentReading, SafeRoadCause } from "./intent-contracts.contracts"
import type { IntentLookup, OwnedSplit, PinnedIntent } from "./intent-policies.contracts"
import { intentEnvelopeSchema } from "./intent-result.schema"

/** The answer of a model that picked no intent. */
const NONE = "none"

/** The longest text a person may reuse as a draft when a turn fails. */
const DRAFT_MAX = 1500

type Safe = Extract<IntentReading, { readonly kind: "safe" }>

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The outermost JSON object of a model answer, fenced or not; null when the text holds none. */
const objectIn = (raw: string): Readonly<Record<string, unknown>> | null => {
    const body = raw.replace(/^\s*```(?:json)?/iu, "").replace(/```\s*$/u, "")
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const read = parseJsonText(body.slice(from, to + 1))
    const value = read.ok ? read.value : null
    return isRecord(value) ? value : null
}

const draftOf = (text: string): string => text.trim().slice(0, DRAFT_MAX)

const safe = (
    cause: SafeRoadCause,
    detail: string,
    rest: Partial<Pick<Safe, "intent" | "gap" | "draft">> = {},
): Safe => ({ kind: "safe", cause, detail, intent: null, gap: null, draft: "", ...rest })

/** The members the other offered intents own and the picked one does not: they are not the picked intent's to write. */
const ownedElsewhere = (picked: IntentContract, offered: ReadonlyArray<IntentContract>): ReadonlyArray<string> =>
    offered
        .filter((contract) => contract.intent !== picked.intent)
        .flatMap((contract) => contract.owns)
        .filter((member) => !picked.owns.includes(member))

/** The result without the members another intent owns, and the names of those that were set. */
const withoutOwned = (raw: Readonly<Record<string, unknown>>, owned: ReadonlyArray<string>): OwnedSplit => ({
    kept: Object.fromEntries(Object.entries(raw).filter(([member]) => !owned.includes(member))),
    dropped: owned.filter((member) => raw[member] !== undefined && raw[member] !== null),
})

const replyOf = (raw: Readonly<Record<string, unknown>>): string => (typeof raw.reply === "string" ? raw.reply : "")

/** The gap a turn that picked nothing names, or null when it named none. */
const gapOf = (gap: IntentGapText | null | undefined): IntentGapText | null =>
    gap === null || gap === undefined || gap.question === "" ? null : { question: gap.question, topic: gap.topic }

/**
 * Reads what a turn answered, in this sequence: the envelope, the intent (an unknown one and a text that is not JSON are invalid output;
 * `none` is no intent), the split of an intent that runs in a turn of its own, the owns rule, the schema of the result and the checks.
 * Nothing here acts: the caller settles what comes back.
 */
export const readIntentResult = (
    text: string,
    contracts: ReadonlyArray<IntentContract>,
    pinned: PinnedIntent,
    lookup: IntentLookup,
): IntentReading => {
    const object = objectIn(text)
    if (object === null) return safe("invalid_output", "not_json", { draft: draftOf(text) })
    const envelope = intentEnvelopeSchema.safeParse(object)
    if (!envelope.success) return safe("invalid_output", "envelope", { draft: draftOf(text) })
    const { intent, result, gap } = envelope.data
    if (intent === NONE) return safe("no_intent", NONE, { gap: gapOf(gap) })
    const contract = contracts.find((entry) => entry.intent === intent)
    if (contract === undefined) return safe("invalid_output", "unknown_intent", { intent, draft: draftOf(text) })
    if (pinned !== null && pinned !== intent) return safe("invalid_output", "not_pinned", { intent })
    if (contract.ownTurn && pinned === null) return { kind: "split", contract }
    const { kept, dropped } = withoutOwned(result ?? {}, ownedElsewhere(contract, contracts))
    const parsed = lookup.resultSchemaOf(contract.result)?.safeParse(kept)
    if (parsed?.success !== true) return safe("invalid_output", "schema", { intent, draft: draftOf(replyOf(kept)) })
    const failed = failedCheckOf(contract.checks, { intent, result: parsed.data }, lookup)
    if (failed !== null) return safe("check_failed", failed, { intent, draft: draftOf(replyOf(parsed.data)) })
    return { kind: "picked", contract, result: parsed.data, dropped }
}
