/**
 * Gives a value the type its holder already guarantees by other means, with no type assertion: a generic port that returns what it
 * was asked for, a handle map built to match its slot declaration, or a test that forges a malformed value on purpose.
 *
 * @param value - The value to type; the caller answers for its shape.
 * @returns The same value, typed as `T`.
 */
export function trusted<T>(value: unknown): T
/** The one implementation behind `trusted`: it hands the value back untouched. */
export function trusted(value: unknown): unknown {
    return value
}
