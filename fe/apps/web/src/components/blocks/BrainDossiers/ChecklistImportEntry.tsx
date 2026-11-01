import { Button } from "@starci/grammar/common"
import { ChecklistImportDialog } from "@/components/composites/ChecklistImportDialog"
import type { ChecklistImportDialogProps } from "@/components/composites/ChecklistImportDialog"

/** The entry that loads the dossiers of a checklist workbook: its label, and the dialog while it is open. */
export interface ChecklistImportEntryView {
    readonly label: string
    readonly dialog: ChecklistImportDialogProps["props"] | null
}

/** What the entry asks of the page. */
export interface ChecklistImportEntryEvents {
    readonly openImport: () => void
    readonly pickImport: (files: Array<File>) => void
    readonly confirmImport: () => void
    readonly closeImport: () => void
}

/** What the entry is given. */
interface ChecklistImportEntryProps {
    readonly view: ChecklistImportEntryView
    readonly on: ChecklistImportEntryEvents
}

/** The heading button that opens the checklist import, with the dialog it opens. */
export const ChecklistImportEntry = (props: ChecklistImportEntryProps) => (
    <>
        <Button intent="neutral" onPress={props.on.openImport}>
            {props.view.label}
        </Button>
        {props.view.dialog === null ? null : (
            <ChecklistImportDialog
                props={props.view.dialog}
                on={{ pick: props.on.pickImport, confirm: props.on.confirmImport, close: props.on.closeImport }}
            />
        )}
    </>
)
