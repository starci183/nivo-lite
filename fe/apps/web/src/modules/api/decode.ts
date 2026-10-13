import type { Outcome } from "./outcome"

/** Whether the value is a plain object whose fields can be read by name. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether the value is a string or null. */
export const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

/** The outcome of an answer whose shape was not the one the contract promises. */
export const malformed = { kind: "unavailable", fault: { code: "shape" }, retryable: false } as const

/** Reads an answer as a list whose every element passes `isItem`; any other shape is malformed. */
export const decodeList =
    <T>(isItem: (value: unknown) => value is T) =>
    (value: unknown): Outcome<ReadonlyArray<T>> => {
        return Array.isArray(value) && value.every(isItem) ? { kind: "ok", value } : malformed
    }

/** Reads an answer as one value that passes `isItem`; any other shape is malformed. */
export const decodeOne =
    <T>(isItem: (value: unknown) => value is T) =>
    (value: unknown): Outcome<T> => {
        return isItem(value) ? { kind: "ok", value } : malformed
    }

/** Reads the empty answer (204) of a command. */
export const decodeNothing = (): Outcome<null> => ({ kind: "ok", value: null })

/** Checks the answer of a call with its decoder; a failed call passes through unchanged. */
export const decoded = <T>(outcome: Outcome<unknown>, decode: (value: unknown) => Outcome<T>): Outcome<T> =>
    outcome.kind === "ok" ? decode(outcome.value) : outcome
