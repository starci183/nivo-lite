import type { IntentTrigger } from "./intent-contracts.contracts"

/** The longest event type a published contract or persisted turn names. */
export const INTENT_TRIGGER_MAX = 80

/** The characters of an event identity; registration and the published graph determine its authority. */
export const INTENT_TRIGGER_PATTERN = /^[a-z][a-z0-9_.:-]*$/iu

/** True for a bounded event identity, without granting it a contract or an adapter. */
export const isIntentTrigger = (value: string): value is IntentTrigger =>
    value.length <= INTENT_TRIGGER_MAX && INTENT_TRIGGER_PATTERN.test(value)
