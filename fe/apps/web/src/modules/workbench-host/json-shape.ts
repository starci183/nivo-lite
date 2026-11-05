/** Whether a value is a plain object (not null, not an array); the narrowing every reader of a wire answer starts with. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
