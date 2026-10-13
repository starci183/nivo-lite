import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { isStatusFilter } from "@/modules/installations"
import type { StatusFilter } from "@/modules/installations"
import { navigation } from "@/modules/i18n"
import { ALL_CATEGORIES } from "./modules.shared"

const SEARCH_URL_DELAY_MS = 250

/** The parts of the filters a change writes to the URL; a part left out keeps its value. */
type FilterChange = { readonly q?: string; readonly status?: string; readonly category?: string }

/** The filters of the catalogue and how to change them. */
export type CatalogFilters = {
    readonly query: string
    readonly status: StatusFilter
    readonly category: string
    readonly isFiltered: boolean
    readonly setQuery: (value: string) => void
    readonly setStatus: (value: string) => void
    readonly setCategory: (value: string | null) => void
    readonly clear: () => void
}

/** The search, status and category of the catalogue: the URL is the source of truth, the query keeps a local copy so typing never waits for the router. */
export const useCatalogFilters = (categoryKeys: ReadonlyArray<string>): CatalogFilters => {
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const params = useSearchParams()
    const urlQuery = params.get("q") ?? ""
    const statusParam = params.get("status")
    const categoryParam = params.get("category")
    const status: StatusFilter = isStatusFilter(statusParam) ? statusParam : "all"
    const category = categoryParam !== null && categoryKeys.includes(categoryParam) ? categoryParam : ALL_CATEGORIES
    const [query, setLocalQuery] = useState(urlQuery)
    const written = useRef(urlQuery)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => {
        // Back and forward changed the URL under us: follow it.
        if (urlQuery !== written.current) {
            written.current = urlQuery
            setLocalQuery(urlQuery)
        }
    }, [urlQuery])
    useEffect(() => () => clearTimeout(timer.current), [])

    const write = (next: FilterChange) => {
        const q = next.q ?? query
        const nextStatus = next.status ?? status
        const nextCategory = next.category ?? category
        const search = new URLSearchParams()
        if (q.trim() !== "") search.set("q", q)
        if (nextStatus !== "all") search.set("status", nextStatus)
        if (nextCategory !== ALL_CATEGORIES) search.set("category", nextCategory)
        written.current = q
        const qs = search.toString()
        router.replace(qs === "" ? pathname : `${pathname}?${qs}`, { scroll: false })
    }
    return {
        query,
        status,
        category,
        isFiltered: query.trim() !== "" || status !== "all" || category !== ALL_CATEGORIES,
        setQuery: (value) => {
            setLocalQuery(value)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => write({ q: value }), SEARCH_URL_DELAY_MS)
        },
        setStatus: (value) => write({ status: isStatusFilter(value) ? value : "all" }),
        setCategory: (value) => write({ category: value ?? ALL_CATEGORIES }),
        clear: () => {
            clearTimeout(timer.current)
            setLocalQuery("")
            written.current = ""
            router.replace(pathname, { scroll: false })
        },
    }
}
