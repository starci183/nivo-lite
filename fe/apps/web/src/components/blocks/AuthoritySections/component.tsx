import { ListBox } from "@starci/grammar/common"

/** One section of the list: its name and the one line of what it holds. */
interface AuthoritySectionRowView {
    readonly id: string
    readonly title: string
    readonly description: string
}

/** The words and values of the section list. */
export interface AuthoritySectionsBaseProps {
    readonly props: {
        readonly label: string
        readonly rows: ReadonlyArray<AuthoritySectionRowView>
        /** The section the address names; null when it names none (the phone's list). */
        readonly selectedId: string | null
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the five sections as the list of the authority panes: each row opens its section's address, the open one is marked. */
export const AuthoritySectionsBase = (props: AuthoritySectionsBaseProps) => (
    <ListBox
        label={props.props.label}
        selectionMode="single"
        selectionIndicator="none"
        selectedIds={props.props.selectedId === null ? [] : [props.props.selectedId]}
        onAction={props.on.select}
        onSelectionChange={(ids) => ids.slice(0, 1).forEach(props.on.select)}
        items={props.props.rows.map((row) => ({ id: row.id, label: row.title, description: row.description }))}
    />
)
