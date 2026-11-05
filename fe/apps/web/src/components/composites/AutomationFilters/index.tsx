import { Tabs } from "@starci/grammar/common"

/** One chip of the filter. */
type AutomationFilterItem = {
    readonly id: string
    readonly label: string
}

/** What the filter chips show. */
type AutomationFiltersProps = {
    readonly label: string
    readonly items: ReadonlyArray<AutomationFilterItem>
    readonly selectedId: string
    readonly onChange: (id: string) => void
}

/** The filter chips (single selection): pressing the chosen chip again keeps the current filter. */
export const AutomationFilters = (props: AutomationFiltersProps) => (
    <Tabs
        kind="filter"
        label={props.label}
        items={props.items.map((item) => ({ id: item.id, label: item.label }))}
        selectedKey={props.selectedId}
        onSelect={props.onChange}
    />
)
