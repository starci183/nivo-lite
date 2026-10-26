"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { navigation } from "@/modules/i18n"
import { ALL_CATEGORIES } from "./modules.shared"

const SEARCH_URL_DELAY_MS = 250

/** The parts of the filters a change writes to the URL; a part left out keeps its value. */
type FilterChange = { readonly q?: string; readonly category?: string }

/** The filters of the role catalogue and how to change them. */
export type CatalogFilters = {
    readonly query: string
    readonly category: string
    readonly isFiltered: boolean
    readonly setQuery: (value: string) => void
    readonly setCategory: (value: string | null) => void
    readonly clear: () => void
}

/** The search and category of the catalogue: the URL is the source of truth, the query keeps a local copy so typing never waits for the router. */
export const useCatalogFilters = (categoryKeys: ReadonlyArray<string>): CatalogFilters => {
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const params = useSearchParams()
    const urlQuery = params.get("q") ?? ""
    const categoryParam = params.get("category")
    const category = categoryParam !== null && categoryKeys.includes(categoryParam) ? categoryParam : ALL_CATEGORIES
    const [query, setQuery] = useState(urlQuery)
    const written = useRef(urlQuery)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => {
        // Back and forward changed the URL under us: follow it.
        if (urlQuery !== written.current) {
            written.current = urlQuery
            setQuery(urlQuery)
        }
    }, [urlQuery])
    useEffect(() => () => clearTimeout(timer.current), [])

    const write = (next: FilterChange) => {
        const q = next.q ?? query
        const nextCategory = next.category ?? category
        const search = new URLSearchParams()
        if (q.trim() !== "") search.set("q", q)
        if (nextCategory !== ALL_CATEGORIES) search.set("category", nextCategory)
        written.current = q
        const qs = search.toString()
        router.replace(qs === "" ? pathname : `${pathname}?${qs}`, { scroll: false })
    }
    return {
        query,
        category,
        isFiltered: query.trim() !== "" || category !== ALL_CATEGORIES,
        setQuery: (value) => {
            setQuery(value)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => write({ q: value }), SEARCH_URL_DELAY_MS)
        },
        setCategory: (value) => write({ category: value ?? ALL_CATEGORIES }),
        clear: () => {
            clearTimeout(timer.current)
            setQuery("")
            written.current = ""
            router.replace(pathname, { scroll: false })
        },
    }
}
