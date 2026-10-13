import { TagGroup } from "@starci/grammar/common"

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
    <TagGroup
        label={props.label}
        selectionMode="single"
        items={props.items}
        selectedIds={[props.selectedId]}
        onSelectionChange={(ids) => {
            const next = props.items.find((item) => item.id === ids[0])
            if (next !== undefined) props.onChange(next.id)
        }}
    />
)
