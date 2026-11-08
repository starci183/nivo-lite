import { ListBox, type ListBoxSection } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** What a pane's sectioned list draws and does. */
interface PaneSectionsProps {
    /** Names the list for assistive technology. */
    readonly label: string
    readonly sections: ReadonlyArray<ListBoxSection>
    readonly selectedId: string | null
    readonly onSelect: (id: string) => void
    /** What shows when no section has a row. */
    readonly empty: ReactNode
    /** The first read has no data yet: each row draws as geometry of the ready ones. */
    readonly isLoading: boolean
}

/** The list of a pane whose rows are grouped under captions: one row is open at a time, and choosing a row opens it. */
export const PaneSections = (props: PaneSectionsProps) => (
    <ListBox
        label={props.label}
        selectionMode="single"
        selectionIndicator="none"
        selectedIds={props.selectedId === null ? [] : [props.selectedId]}
        onAction={props.onSelect}
        onSelectionChange={(ids) => ids.slice(0, 1).forEach((id) => props.onSelect(id))}
        isLoading={props.isLoading}
        emptyContent={props.empty}
        sections={props.sections}
    />
)
