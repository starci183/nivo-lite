"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryBrainFactsPageSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
import { toBrainFact } from "@/modules/brain"
import type { BrainFact, SlotRead } from "@/modules/types"
import { FACTS_PAGE_SIZE } from "@/modules/documents"

/** How long the search waits for the next key before it asks the server. */
const SEARCH_WAIT_MS = 300

/** What the list asks the server for. */
interface FactsPageInput {
    /** The server states the list is narrowed to; undefined = the default (in force, scheduled and waiting). */
    readonly statuses: ReadonlyArray<string> | undefined
    /** The words typed in the search box, as typed. */
    readonly search: string
    /** False while the list is drawn from something else (no read is made). */
    readonly enabled: boolean
}

/** One page of the facts list as the server answered it, with the cursor stack that lets the reader go back. */
export interface FactsPage {
    /** The facts of the page; undefined until the first answer. */
    readonly facts: ReadonlyArray<BrainFact> | undefined
    readonly read: SlotRead<ReadonlyArray<BrainFact>>
    /** Every fact the filter matches, on every page. */
    readonly total: number
    /** The page shown, from 1. */
    readonly page: number
    /** How many pages are reachable now: the ones seen and the next one when the server has more. */
    readonly pageCount: number
    /** The first and last fact of the page, from 1, for the summary. */
    readonly span: { readonly from: number; readonly to: number }
    readonly go: (page: number) => void
    /** Reads the page again: the retry of a failed list. */
    readonly reload: () => void
}

/** The cursor stack of the list: the cursor each visited page was asked with, and the page shown. */
interface PageNav {
    readonly key: string
    readonly stack: ReadonlyArray<string | null>
    readonly index: number
}

/**
 * The facts list read page by page from the server: the search (waited for 300 ms), the states and the cursor go in the request, the
 * total and the next cursor come back. A page seen before is reached again from the stack; an unseen one only by the next cursor.
 */
export const useFactsPage = (input: FactsPageInput): FactsPage => {
    const [debounced, setDebounced] = useState(input.search)
    useEffect(() => {
        const id = setTimeout(() => setDebounced(input.search), SEARCH_WAIT_MS)
        return () => clearTimeout(id)
    }, [input.search])
    const search = debounced.trim()
    const key = `${input.statuses?.join(",") ?? "default"}|${search}`
    const [nav, setNav] = useState<PageNav>({ key, stack: [null], index: 0 })
    const current: PageNav = nav.key === key ? nav : { key, stack: [null], index: 0 }
    const after = current.stack[current.index] ?? null
    const answer = useQueryBrainFactsPageSwr(
        input.enabled
            ? {
                  first: FACTS_PAGE_SIZE,
                  // A field the list does not narrow by is left out, never sent as null: the back end answers `statuses: null` with an internal error.
                  after: after ?? undefined,
                  search: search === "" ? undefined : search,
                  sourceId: undefined,
                  subjectType: undefined,
                  statuses: input.statuses === undefined ? undefined : [...input.statuses],
              }
            : null,
    )
    const data = answer.data
    const facts = useMemo(() => data?.facts.map((row) => toBrainFact(row)), [data])
    const total = data?.factsTotal ?? 0
    const nextCursor = data?.factsNextCursor ?? null
    const known = current.stack.length + (nextCursor !== null && current.index === current.stack.length - 1 ? 1 : 0)
    const from = facts === undefined || facts.length === 0 ? 0 : current.index * FACTS_PAGE_SIZE + 1
    return {
        facts,
        read: { data: facts, error: readError(answer), isLoading: input.enabled && answer.isLoading },
        total,
        page: current.index + 1,
        pageCount: known,
        span: { from, to: from === 0 ? 0 : from + (facts?.length ?? 0) - 1 },
        reload: () => void answer.mutate(),
        go: (page) => {
            const target = page - 1
            if (target <= current.stack.length - 1 && target >= 0) setNav({ ...current, index: target })
            else if (target === current.index + 1 && nextCursor !== null)
                setNav({ key, stack: [...current.stack.slice(0, current.index + 1), nextCursor], index: target })
        },
    }
}
