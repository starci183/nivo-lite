import type { BrainFilterView, DataSlot } from "@/modules/types"

/** One narrowing the tabs of a list offer: the id the entries carry, and its words. */
interface FilterChoice {
    readonly id: string
    readonly label: string
}

/**
 * The status of a list of entries: waiting while the read is, failed when it is, empty when no entry exists, otherwise the entries
 * the filter and the search keep (which may be none: the list says so itself).
 */
export const entriesSlotOf = <T>(
    source: DataSlot<unknown>,
    all: ReadonlyArray<T>,
    shown: ReadonlyArray<T>,
): DataSlot<ReadonlyArray<T>> => {
    if ("isLoading" in source) return { isLoading: true }
    if ("isForbidden" in source) return { isForbidden: true }
    if ("isError" in source) return { isError: true }
    return all.length === 0 ? { isEmpty: true } : { items: shown }
}

/** The tabs of a list: "all" first, then each choice that holds at least one entry, each with its count. */
export const filterTabsOf = (
    entries: ReadonlyArray<{ readonly filter: string }>,
    all: string,
    choices: ReadonlyArray<FilterChoice>,
): ReadonlyArray<BrainFilterView> => [
    { id: "all", label: all, count: entries.length },
    ...choices
        .map((choice) => ({
            id: choice.id,
            label: choice.label,
            count: entries.filter((entry) => entry.filter === choice.id).length,
        }))
        .filter((tab) => tab.count > 0),
]
