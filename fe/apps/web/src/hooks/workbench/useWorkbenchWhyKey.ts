"use client"

import { useSearchParams } from "next/navigation"

/** The query key that opens the why pane on a work item. `?focus=` already means a conversation or a decision, so it cannot carry a third meaning. */
const WHY_QUERY_KEY = "why"

/** The work item whose why pane is open (`?why=`), null when none, and the command that closes it by removing the key from the query. */
export const useWorkbenchWhyKey = () => {
    const params = useSearchParams()
    const value = params.get(WHY_QUERY_KEY)
    const close = () => {
        const query = new URLSearchParams(window.location.search)
        query.delete(WHY_QUERY_KEY)
        const rest = query.toString()
        window.history.replaceState(null, "", rest === "" ? window.location.pathname : `?${rest}`)
    }
    return { workItemId: value === null || value === "" ? null : value, close }
}
