/**
 * The query string a route has after writing several keys at once: every entry sets its key, a null entry removes it. The result is
 * built from the query as it is now, so one replace carries all the writes (two writes in a row would each start from the old query).
 */
export const mergedQuery = (current: string, entries: Readonly<Record<string, string | null>>): string => {
    const params = new URLSearchParams(current)
    for (const [key, value] of Object.entries(entries)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
    }
    return params.toString()
}

/** The address a route replaces itself with: the path, then the merged query when it has any. */
export const addressWithQuery = (path: string, query: string): string => (query === "" ? path : `${path}?${query}`)
