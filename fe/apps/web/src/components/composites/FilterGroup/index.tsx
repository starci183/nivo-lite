import { SearchField, Stack, Tabs } from "@starci/grammar/common"
import type { BrainFilterView } from "@/modules/types"

/** The search field of a filter group: its words, its text and the command that changes it. */
export interface FilterGroupSearch {
    readonly label: string
    readonly placeholder: string
    readonly clearLabel: string
    readonly value: string
    readonly onChange: (value: string) => void
}

/** One choice of the filter row: its words and, when known, how many rows it holds. */
interface FilterGroupOption {
    readonly value: string
    readonly label: string
    readonly count?: number
}

/** The single-choice filter row, drawn as underline filter tabs with their counts (owner rule): its options and the chosen one. */
export interface FilterGroupChoice {
    readonly label: string
    readonly options: ReadonlyArray<FilterGroupOption>
    readonly value: string
    readonly onChange: (value: string) => void
    /** The name of the "+n" menu that holds the tabs that do not fit, with `{count}` where the number goes. */
    readonly moreLabel?: string
}

/** One filter tab: its value, its label and its count when the list knows it. */
const tabOf = (option: FilterGroupOption) =>
    option.count === undefined
        ? { id: option.value, label: option.label }
        : { id: option.value, label: option.label, count: option.count }

/** What the filter group draws: either control, or both. */
interface FilterGroupProps {
    readonly search?: FilterGroupSearch
    readonly choice?: FilterGroupChoice
    /** The options are still being read: the search stays real text with its placeholder and only marks its results pending (page-loading-own-shape). */
    readonly isLoading?: boolean
}

/**
 * The one filter group of every list: a search field over the single-choice filter row, drawn as filter tabs; the ones that do not fit
 * fold into a "+n" menu. The search is real text while the read waits, so the head of a list never shifts or blinks when the options land.
 */
export const FilterGroup = (props: FilterGroupProps) => {
    const template = props.choice?.moreLabel
    const moreLabel =
        template === undefined ? undefined : (count: number): string => template.replace("{count}", String(count))
    const moreProp = moreLabel === undefined ? {} : { moreLabel }
    return (
        <Stack gap="row">
            {props.search === undefined ? null : (
                <SearchField
                    label={props.search.label}
                    isLabelHidden
                    isPending={props.isLoading === true}
                    placeholder={props.search.placeholder}
                    clearLabel={props.search.clearLabel}
                    value={props.search.value}
                    onValueChange={props.search.onChange}
                    onClear={() => props.search?.onChange("")}
                />
            )}
            {props.choice === undefined ? null : (
                <Tabs
                    kind="filter"
                    label={props.choice.label}
                    selectedKey={props.choice.value}
                    onSelect={props.choice.onChange}
                    items={props.choice.options.map((option) => tabOf(option))}
                    {...moreProp}
                />
            )}
        </Stack>
    )
}

/** The words of the filter tabs of a list: their name and the name of the "+n" menu. */
interface FilterChoiceWords {
    readonly label: string
    readonly moreLabel: string
}

/** The filter tabs of a Second Brain list (each with its count) as the filter group draws them. */
export const filterChoiceOf = (
    filters: ReadonlyArray<BrainFilterView>,
    value: string,
    words: FilterChoiceWords,
    onChange: (id: string) => void,
): FilterGroupChoice => ({
    label: words.label,
    options: filters.map((one) => ({
        value: one.id,
        label: one.label,
        ...(one.count === undefined ? {} : { count: one.count }),
    })),
    value,
    onChange,
    moreLabel: words.moreLabel,
})
