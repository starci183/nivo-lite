"use client"

import { useEffect, useState } from "react"
import { ALL_OPTION } from "@/modules/inbox"

/** How long the words of the search rest before the list is read again. */
const SEARCH_REST_MS = 300

/** What the user chose above the list, and the commands that change it. */
interface InboxChoiceState {
    readonly tab: string
    readonly query: string
    /** The search as the read uses it: trimmed, after it rested. */
    readonly search: string
    readonly channel: string
    readonly agent: string
    readonly sort: string
    /** The customer the user opened; null until they open one. */
    readonly chosen: string | null
    readonly setTab: (id: string) => void
    readonly setQuery: (value: string) => void
    readonly setChannel: (id: string) => void
    readonly setAgent: (id: string) => void
    readonly setSort: (id: string) => void
    readonly choose: (id: string) => void
}

/** The tab, search, selects and opened customer of the inbox, held where the page is. */
export const useInboxChoice = (): InboxChoiceState => {
    const [tab, setTab] = useState("all")
    const [query, setQuery] = useState("")
    const [search, setSearch] = useState("")
    const [channel, setChannel] = useState(ALL_OPTION)
    const [agent, setAgent] = useState(ALL_OPTION)
    const [sort, setSort] = useState("recent")
    const [chosen, choose] = useState<string | null>(null)
    useEffect(() => {
        const timer = setTimeout(() => setSearch(query.trim()), SEARCH_REST_MS)
        return () => clearTimeout(timer)
    }, [query])
    return { tab, query, search, channel, agent, sort, chosen, setTab, setQuery, setChannel, setAgent, setSort, choose }
}
