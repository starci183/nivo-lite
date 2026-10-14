import { foldText, STATUS_FILTERS } from "@/modules/installations"
import type { StatusFilter } from "@/modules/installations"
import { useCatalogFilters } from "./useCatalogFilters"
import type { CatalogFilters } from "./useCatalogFilters"
import { ALL_CATEGORIES } from "./modules.shared"

/** One agent of the catalogue as the page prepared it; `card` is what the block draws. */
type CatalogEntry<Card> = {
    readonly key: string
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    readonly installed: boolean
    readonly isEarly: boolean
    readonly card: Card
}

/** The categories with the entries that match the filters, and the filters themselves. */
type CatalogView<Card> = {
    readonly filters: CatalogFilters
    readonly statusKeys: ReadonlyArray<StatusFilter>
    readonly shownCount: number
    readonly groups: ReadonlyArray<{
        readonly key: string
        readonly label: string
        readonly cards: ReadonlyArray<{ readonly key: string; readonly card: Card }>
    }>
}

/**
 * Filters the catalogue by the search, status and category of the URL and groups what is left by category, the installed agents first.
 * While the installations load nobody is known to be installed, so the install filters wait.
 */
export const useCatalogView = <Card>(
    entries: ReadonlyArray<CatalogEntry<Card>>,
    categories: ReadonlyArray<{ readonly key: string; readonly label: string }>,
    isLoading: boolean,
): CatalogView<Card> => {
    const filters = useCatalogFilters(categories.map((category) => category.key))
    const tokens = foldText(filters.query)
        .split(/\s+/u)
        .filter((token) => token !== "")
    const shown = entries.filter(
        (entry) =>
            (filters.category === ALL_CATEGORIES || entry.categoryKey === filters.category) &&
            (isLoading || filters.status !== "installed" || entry.installed) &&
            (isLoading || filters.status !== "notInstalled" || !entry.installed) &&
            (filters.status !== "early" || entry.isEarly) &&
            (isLoading || tokens.every((token) => entry.searchText.includes(token))),
    )
    const groups = categories
        .map((category) => ({
            key: category.key,
            label: category.label,
            cards: shown
                .filter((entry) => entry.categoryKey === category.key)
                .sort((a, b) => Number(b.installed) - Number(a.installed))
                .map((entry) => ({ key: entry.key, card: entry.card })),
        }))
        .filter((group) => group.cards.length > 0)
    return { filters, statusKeys: STATUS_FILTERS, shownCount: shown.length, groups }
}
