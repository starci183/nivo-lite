import { foldText } from "@/modules/installations"
import { useCatalogFilters } from "./useCatalogFilters"
import type { CatalogFilters } from "./useCatalogFilters"
import { ALL_CATEGORIES } from "./modules.shared"

/** One role of the catalogue as the page prepared it; `card` is what the block draws. */
type CatalogRole<Card> = {
    readonly key: string
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    readonly card: Card
}

/** The roles that match the filters, and the filters themselves. */
type CatalogView<Card> = {
    readonly filters: CatalogFilters
    readonly cards: ReadonlyArray<{ readonly key: string; readonly card: Card }>
}

/** Filters the roles by the search and category of the URL. While the data loads the search waits, so the skeletons stay stable. */
export const useCatalogView = <Card>(
    roles: ReadonlyArray<CatalogRole<Card>>,
    categories: ReadonlyArray<{ readonly key: string; readonly label: string }>,
    isLoading: boolean,
): CatalogView<Card> => {
    const filters = useCatalogFilters(categories.map((category) => category.key))
    const tokens = foldText(filters.query)
        .split(/\s+/u)
        .filter((token) => token !== "")
    const cards = roles
        .filter(
            (role) =>
                (filters.category === ALL_CATEGORIES || role.categoryKey === filters.category) &&
                (isLoading || tokens.every((token) => role.searchText.includes(token))),
        )
        .map((role) => ({ key: role.key, card: role.card }))
    return { filters, cards }
}
