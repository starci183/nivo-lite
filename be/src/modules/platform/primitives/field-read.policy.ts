/** The value as text, or undefined when it is not text. */
export const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The value as text, or null when it is not text. */
export const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The value as a finite number (a numeric string counts), or undefined. */
export const numberOf = (value: unknown): number | undefined => {
    const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN
    return Number.isFinite(parsed) ? parsed : undefined
}
