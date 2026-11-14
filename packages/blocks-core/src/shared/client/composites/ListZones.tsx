import type { FilterFields, FooterZone, HeaderZone, SearchFields } from "@starci/grammar/common"
import { tabEntriesOf, type TabCounts, type TabSpec } from "../../rows/filter-tabs"
import { useBlockWords } from "./useBlockWords"

/** The words the filter tabs of a list are given. */
export interface FilterTabsInput {
    /** The accessible name of the tab list. */
    readonly label: string
    /** The words of the tab that shows every row. */
    readonly allLabel: string
    readonly specs: ReadonlyArray<TabSpec>
    /** The counts under the same search; null while unknown or when no read gives them. */
    readonly counts: TabCounts | null
    readonly selectedKey: string
    readonly onSelect: (key: string) => void
}

/** The filter zone of a list card: underline tabs with their count chips. */
export const filterFieldsOf = (input: FilterTabsInput, words: ReturnType<typeof useBlockWords>): FilterFields => ({
    label: input.label,
    items: tabEntriesOf(input.allLabel, input.specs, input.counts),
    selectedKey: input.selectedKey,
    onSelect: input.onSelect,
    moreLabel: (count) => words({ key: "filtersMore" }).replaceAll("{count}", String(count)),
    overflowLabel: words({ key: "filtersOverflow" }),
})

/** The header zones of a list card, one row each so the shell divides them: the search, then the filter tabs. A list with neither has no header. */
export const headerZonesOf = (search: SearchFields | null, filter: FilterFields | null): ReadonlyArray<HeaderZone> => [
    ...(search === null ? [] : [{ kind: "search" as const, ...search }]),
    ...(filter === null ? [] : [{ kind: "filter" as const, ...filter }]),
]

/** What the paging zone is given. */
export interface PagingInput {
    readonly page: number
    readonly pageCount: number
    readonly onPage: (page: number) => void
}

/** The footer zone of a list card: the pager, only once the rows pass one page. */
export const footerZonesOf = (
    paging: PagingInput,
    words: ReturnType<typeof useBlockWords>,
): ReadonlyArray<FooterZone> =>
    paging.pageCount < 2
        ? []
        : [
              {
                  kind: "paging",
                  page: paging.page,
                  pageCount: paging.pageCount,
                  onPage: paging.onPage,
                  labels: {
                      nav: words({ key: "tablePagination" }),
                      previous: words({ key: "tablePrevious" }),
                      next: words({ key: "tableNext" }),
                      page: (number) => `${words({ key: "tablePage" })} ${number}`,
                  },
              },
          ]
