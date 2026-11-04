/** Whether a value is a plain record: an object that is neither null nor a list. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
