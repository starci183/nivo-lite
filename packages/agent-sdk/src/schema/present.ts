import { AbsentError } from "./absent-error"

/**
 * Narrows a value that a caller knows is there, so an indexed read of a fixture needs no non-null assertion.
 *
 * @param value - The value, or `undefined` when the caller's knowledge was wrong.
 * @returns The value itself.
 * @throws AbsentError with code `ABSENT` when the value is `undefined`.
 */
export const present = <T>(value: T | undefined): T => {
    if (value === undefined) throw new AbsentError("a value the caller counted on is not there")
    return value
}
