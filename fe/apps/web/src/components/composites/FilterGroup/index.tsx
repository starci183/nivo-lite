import { FilterButtonGroup, SearchField, Stack } from "@starci/grammar/common"
import type { FilterOption } from "@starci/grammar/common"

/** The search field of a filter group: its words, its text and the command that changes it. */
export interface FilterGroupSearch {
    readonly label: string
    readonly placeholder: string
    readonly clearLabel: string
    readonly value: string
    readonly onChange: (value: string) => void
}

/** The single-choice filter row: its options, the chosen one, and the words of the "+N" overflow list. */
export interface FilterGroupChoice {
    readonly label: string
    readonly options: ReadonlyArray<FilterOption>
    readonly value: string
    readonly onChange: (value: string) => void
    readonly moreLabel: (count: number) => string
    readonly searchLabel: string
    readonly emptyLabel: string
}

/** What the filter group draws: either control, or both. */
interface FilterGroupProps {
    readonly search?: FilterGroupSearch
    readonly choice?: FilterGroupChoice
    /** The options are still being read: the search keeps its real words and the choice row draws as buttons under a shimmer. */
    readonly isLoading?: boolean
}

/**
 * The one filter group of every list: a search field over the single-choice filter row, whose options that do not fit
 * collapse into a "+N" list. Both keep their box while the read waits, so the head of a list never shifts when the options land.
 */
export const FilterGroup = (props: FilterGroupProps) => (
    <Stack gap="row">
        {props.search === undefined ? null : (
            <SearchField
                label={props.search.label}
                isLabelHidden
                placeholder={props.search.placeholder}
                clearLabel={props.search.clearLabel}
                value={props.search.value}
                onValueChange={props.search.onChange}
                onClear={() => props.search?.onChange("")}
            />
        )}
        {props.choice === undefined ? null : (
            <FilterButtonGroup
                label={props.choice.label}
                options={props.choice.options}
                value={props.choice.value}
                onValueChange={props.choice.onChange}
                moreLabel={props.choice.moreLabel}
                searchLabel={props.choice.searchLabel}
                emptyLabel={props.choice.emptyLabel}
                {...(props.isLoading === true ? { isLoading: true } : {})}
            />
        )}
    </Stack>
)
