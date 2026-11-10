"use client"

import { useMemo, useState } from "react"
import { indexDocs, resultCount, searchDocs } from "@/modules/guide"
import type { GuideDoc, GuideResults } from "@/modules/guide"

/** The query of the drawer and what it finds. */
export interface GuideSearchView {
    readonly query: string
    readonly setQuery: (query: string) => void
    readonly results: GuideResults
    readonly count: number
    /** The query has words, so the thread shows it and what it found. */
    readonly isSearching: boolean
}

/** Searches as you type: the documents are read once when they change, each key only ranks them. */
export const useGuideSearch = (docs: ReadonlyArray<GuideDoc>): GuideSearchView => {
    const [query, setQuery] = useState("")
    const indexed = useMemo(() => indexDocs(docs), [docs])
    const trimmed = query.trim()
    const results = useMemo(() => (trimmed === "" ? {} : searchDocs(trimmed, indexed)), [trimmed, indexed])
    return { query, setQuery, results, count: resultCount(results), isSearching: trimmed !== "" }
}
