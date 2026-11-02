import type { CheckInput, IntentCheck, IntentLookup, OptionalCheckKey } from "./intent-policies.contracts"
import type { IntentCheckKey } from "./intent-contracts.contracts"

const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== ""

/** The checks of the generic request, by key: pure functions of the parsed result. */
export const REQUEST_CHECKS: Readonly<Record<IntentCheckKey, IntentCheck>> = {
    action_is_intent: ({ intent, result }) => result.action === intent,
    action_has_summary: ({ result }) => filled(result.summary),
}

/** The first check of the list the result fails, or null when it passes them all. A key nobody registered fails. */
export const failedCheckOf = (
    keys: ReadonlyArray<IntentCheckKey>,
    input: CheckInput,
    lookup: IntentLookup,
): OptionalCheckKey => keys.find((key) => lookup.checkOf(key)?.(input) !== true) ?? null
