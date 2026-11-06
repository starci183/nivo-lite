import type { FilterFields, HeaderZone, SearchFields } from "@starci/grammar/common"

/**
 * The header zones of a list card: the filter tabs and the search in one toolbar row when it has both, else the one it has.
 * A card with neither has no header.
 */
export const paneHeadersOf = (filter: FilterFields | null, search: SearchFields | null): ReadonlyArray<HeaderZone> => {
    if (filter !== null && search !== null) return [{ kind: "toolbar", filter, search }]
    if (filter !== null) return [{ kind: "filter", ...filter }]
    if (search !== null) return [{ kind: "search", ...search }]
    return []
}
