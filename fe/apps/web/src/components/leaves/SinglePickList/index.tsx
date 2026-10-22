import type { ReactNode } from "react"
import { ListBox } from "@starci/grammar/common"

/** One row of a single-pick list, with every word resolved. */
interface SinglePickRow {
    readonly id: string
    readonly label: string
    readonly description: string
    readonly isSelected: boolean
    /** The mark drawn before the label, if any. */
    readonly leading?: ReactNode
}

/** A list where one row is picked at a time. */
interface SinglePickListProps {
    readonly label: string
    readonly rows: ReadonlyArray<SinglePickRow>
    /** The rows are still loading: the list draws waiting rows. */
    readonly isSkeleton: boolean
    readonly onPick: (id: string) => void
}

/** The rail list of a page: the grammar list owns the rows, the selected face and the keyboard model. */
export const SinglePickList = (props: SinglePickListProps) => (
    <ListBox
        label={props.label}
        selectionMode="single"
        isLoading={props.isSkeleton}
        loadingRows={3}
        selectedIds={props.rows.filter((row) => row.isSelected).map((row) => row.id)}
        onSelectionChange={(ids) => {
            const picked = props.rows.find((row) => row.id === ids[0])
            if (picked) props.onPick(picked.id)
        }}
        items={props.rows.map((row) => ({
            id: row.id,
            label: row.label,
            description: row.description,
            leading: row.leading,
        }))}
    />
)
