import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the intent-contracts capability. */
export enum IntentContractsErrorCode {
    /** A frame names a result or a check that nobody registered. */
    KeyUnknown = "INTENT_CONTRACTS_KEY_UNKNOWN",
    /** A key is not a bounded lower-case word. */
    KeyInvalid = "INTENT_CONTRACTS_KEY_INVALID",
    /** A key, or a frame of an intent and a trigger, is registered twice. */
    KeyDuplicate = "INTENT_CONTRACTS_KEY_DUPLICATE",
}

/** How each intent-contracts code travels. */
export const INTENT_CONTRACTS_ERROR_KINDS: Record<IntentContractsErrorCode, ErrorKind> = {
    [IntentContractsErrorCode.KeyUnknown]: "internal",
    [IntentContractsErrorCode.KeyInvalid]: "internal",
    [IntentContractsErrorCode.KeyDuplicate]: "internal",
}

/** The one error class of the intent-contracts capability. */
export class IntentContractsError extends DomainError<IntentContractsErrorCode> {}
