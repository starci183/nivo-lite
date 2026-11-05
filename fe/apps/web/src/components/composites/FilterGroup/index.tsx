import { SearchField, Stack, Tabs } from "@starci/grammar/common"

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

/** The single-choice filter row, drawn as tabs (owner rule: filters are tabs): its options and the chosen one. */
export interface FilterGroupChoice {
    readonly label: string
    readonly options: ReadonlyArray<FilterGroupOption>
    readonly value: string
    readonly onChange: (value: string) => void
    /** The words of the two scroll carets when the tabs do not fit. */
    readonly scrollPreviousLabel?: string
    readonly scrollNextLabel?: string
}

/** What the filter group draws: either control, or both. */
interface FilterGroupProps {
    readonly search?: FilterGroupSearch
    readonly choice?: FilterGroupChoice
    /** The options are still being read: the search draws as its skeleton. */
    readonly isLoading?: boolean
}

/**
 * The one filter group of every list: a search field over the single-choice filter row, drawn as tabs that scroll when they do
 * not fit. The search keeps its box while the read waits, so the head of a list never shifts when the options land.
 */
export const FilterGroup = (props: FilterGroupProps) => (
    <Stack gap="row">
        {props.search === undefined ? null : (
            <SearchField
                label={props.search.label}
                isLabelHidden
                isLoading={props.isLoading === true}
                placeholder={props.search.placeholder}
                clearLabel={props.search.clearLabel}
                value={props.search.value}
                onValueChange={props.search.onChange}
                onClear={() => props.search?.onChange("")}
            />
        )}
        {props.choice === undefined ? null : (
            <Tabs
                label={props.choice.label}
                selectedKey={props.choice.value}
                onSelect={props.choice.onChange}
                items={props.choice.options.map((option) => ({
                    id: option.value,
                    label: option.count === undefined ? option.label : `${option.label} ${option.count}`,
                }))}
                {...(props.choice.scrollPreviousLabel === undefined
                    ? {}
                    : { scrollPreviousLabel: props.choice.scrollPreviousLabel })}
                {...(props.choice.scrollNextLabel === undefined
                    ? {}
                    : { scrollNextLabel: props.choice.scrollNextLabel })}
            />
        )}
    </Stack>
)
