import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { ParamHandle } from "@nivo-lite/agent-sdk/block"
import { SearchField } from "@starci/grammar/common"
import { pendingQuery, queryOf, SEARCH_DEBOUNCE_MS } from "../../rows/search"

/** The text of a search field and how it is typed. */
interface SearchText {
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
const useSearchText = (current: string | null, write: (value: string | null) => void): SearchText => {
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

/** What the search field of the pane takes. */
export interface PaneSearchProps {
    /** The name of the spec param the search writes. */
    readonly param: string
    /** The params of the page. */
    readonly params: ParamHandle
    /** The name and placeholder of the field. */
    readonly label: string
    /** The name of the clear button. */
    readonly clearLabel: string
}

/** The search field of the pane, which owns the text typed and writes the search param. */
export const PaneSearch = (props: PaneSearchProps): ReactNode => {
    const search = useSearchText(props.params.value(props.param), (value) => props.params.set(props.param, value))
    return (
        <SearchField
            label={props.label}
            isLabelHidden
            placeholder={props.label}
            clearLabel={props.clearLabel}
            value={search.text}
            onValueChange={search.type}
            onClear={search.clear}
        />
    )
}
