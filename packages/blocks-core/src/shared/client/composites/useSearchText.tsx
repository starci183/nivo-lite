import { useEffect, useRef, useState } from "react"
import { pendingQuery, queryOf, SEARCH_DEBOUNCE_MS } from "../../rows/search"

/** The text of a search field and how it is typed. */
export interface SearchText {
    /** What the field shows now. */
    readonly text: string
    /** The person typed: the param is written once they pause. */
    readonly type: (text: string) => void
    /** The person cleared the field (button or Escape): the param is cleared at once. */
    readonly clear: () => void
}

/**
 * Keeps the text typed in a search field locally and writes it to the search param 300 ms after the last keystroke. A change of
 * the param from elsewhere (a "clear the search" control in the list) replaces the text.
 */
export const useSearchText = (current: string | null, write: (value: string | null) => void): SearchText => {
    const [text, setText] = useState(current ?? "")
    const seen = useRef(queryOf(current))
    const writer = useRef(write)
    useEffect(() => {
        writer.current = write
    })
    useEffect(() => {
        const next = queryOf(current)
        if (next === seen.current) return
        seen.current = next
        setText(next ?? "")
    }, [current])
    useEffect(() => {
        const pending = pendingQuery(text, seen.current)
        if (pending === null) return undefined
        const timer = setTimeout(() => {
            seen.current = pending.value
            writer.current(pending.value)
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [text])
    return {
        text,
        type: setText,
        clear: () => {
            setText("")
            seen.current = null
            writer.current(null)
        },
    }
}
