/** What a caught cause carries, read without a cast: its `code` and its `params`, each as the unknown value it is (absent for a cause that is not an object). */
export const causeFactsOf = (cause: unknown): { readonly code?: unknown; readonly params?: unknown } => {
    if (typeof cause !== "object" || cause === null) return {}
    const code: unknown = Reflect.get(cause, "code")
    const params: unknown = Reflect.get(cause, "params")
    return { code, params }
}

/** The `params` of a caught cause as a record, an empty one when the cause has none. */
export const causeParamsOf = (cause: unknown): Readonly<Record<string, unknown>> => {
    const params = causeFactsOf(cause).params
    return typeof params === "object" && params !== null ? Object.fromEntries(Object.entries(params)) : {}
}
