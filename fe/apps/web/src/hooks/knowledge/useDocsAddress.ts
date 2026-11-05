"use client"

import { useSearchParams } from "next/navigation"
import type { ModuleKey } from "@/modules/catalog"
import type { DocTabId } from "@/modules/types"
import { docTabOf, moduleFilterOf } from "@/modules/documents"

/** The query keys the documents screen keeps in its address: the address is the one place it keeps them. */
const KEYS = { query: "q", tab: "filter", module: "module" } as const

/** Replaces one key of the address without leaving the page; an empty value takes the key out. */
const writeKey = (key: string, value: string | undefined): void => {
    const query = new URLSearchParams(window.location.search)
    if (value === undefined || value === "") query.delete(key)
    else query.set(key, value)
    const rest = query.toString()
    window.history.replaceState(null, "", rest === "" ? window.location.pathname : `?${rest}`)
}

/** What the address says about the documents list, and the commands that change it. */
interface DocsAddress {
    readonly query: string
    readonly tab: DocTabId
    readonly module: ModuleKey | "all"
    /** The item of the base knowledge in view, when the address names one. */
    readonly item: string | undefined
    /** The drawer that adds documents is asked for (`add`), with the topic and the tag it was opened from. */
    readonly add: string | undefined
    readonly topic: string | undefined
    readonly tag: string | undefined
    /** The keys that follow the person from one screen of the library to the next, as the tail of an address. */
    readonly carried: Readonly<Record<string, string | undefined>>
    readonly setQuery: (value: string) => void
    readonly setTab: (id: DocTabId) => void
    readonly setModule: (value: string | null) => void
}

/** The search text, the filter and the agent of the documents list, read from and written to the address. */
export const useDocsAddress = (): DocsAddress => {
    const params = useSearchParams()
    const module = moduleFilterOf(params.get(KEYS.module))
    const tab = params.get(KEYS.tab)
    const query = params.get(KEYS.query) ?? ""
    return {
        query,
        tab: docTabOf(tab),
        module,
        item: params.get("item") ?? undefined,
        add: params.get("add") ?? undefined,
        topic: params.get("topic") ?? undefined,
        tag: params.get("tag") ?? undefined,
        carried: {
            q: query === "" ? undefined : query,
            filter: tab === null ? undefined : docTabOf(tab),
            module: module === "all" ? undefined : module,
        },
        setQuery: (value) => writeKey(KEYS.query, value),
        setTab: (id) => writeKey(KEYS.tab, id === "all" ? undefined : id),
        setModule: (value) => writeKey(KEYS.module, moduleFilterOf(value) === "all" ? undefined : (value ?? undefined)),
    }
}
