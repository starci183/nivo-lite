import { Tabs } from "@starci/grammar/common"

/** One filter: what it is called and how many items it keeps. */
export interface FilterButtonView {
    readonly id: string
    readonly label: string
}

/** What the row of filters says and calls. */
interface FilterButtonsProps {
    /** Names the group for assistive technology. */
    readonly label: string
    readonly options: ReadonlyArray<FilterButtonView>
    /** The id of the filter that is on. */
    readonly value: string
    readonly onValueChange: (id: string) => void
}

/** Adapts the app's filter identities to the grammar's filter tabs. */
export const FilterButtons = (props: FilterButtonsProps) => (
    <Tabs
        kind="filter"
        label={props.label}
        items={props.options.map((option) => ({ id: option.id, label: option.label }))}
        selectedKey={props.value}
        onSelect={props.onValueChange}
    />
)
