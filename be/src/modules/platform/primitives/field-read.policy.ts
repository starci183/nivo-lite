import type { NullableFieldText, OptionalFieldNumber, OptionalFieldText } from "./field-read.contracts"

/** The value as text, or undefined when it is not text. */
export const fieldTextOf = (value: unknown): OptionalFieldText => (typeof value === "string" ? value : undefined)

/** The value as text, or null when it is not text. */
export const fieldTextOrNullOf = (value: unknown): NullableFieldText => (typeof value === "string" ? value : null)

/** The value as a finite number (a numeric string counts), or undefined. */
export const fieldNumberOf = (value: unknown): OptionalFieldNumber => {
    const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN
    return Number.isFinite(parsed) ? parsed : undefined
}
