import { Alert, Button, Dialog, FileDropzone, Text } from "@starci/grammar/common"
import { BODY_CLASS_NAME } from "./classNames"

/** The words, state and commands of the dialog that loads the dossiers of a checklist workbook. */
export interface ChecklistImportDialogProps {
    readonly props: {
        readonly title: string
        readonly intro: string
        /** What the import replaces, said before it does. */
        readonly warning: string
        readonly dropLabel: string
        readonly dropPrompt: string
        readonly dropHint: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly confirmLabel: string
        /** The workbook picked, by name; null before one is. */
        readonly fileName: string | null
        readonly isImporting: boolean
    }
    readonly on: {
        readonly pick: (files: Array<File>) => void
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** Loads the dossiers of a checklist workbook: pick the file, read what the import replaces, then import. */
export const ChecklistImportDialog = (props: ChecklistImportDialogProps) => {
    const { props: view, on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) on.close()
            }}
            size="md"
            title={view.title}
            closeLabel={view.closeLabel}
            description={view.intro}
            footer={
                <>
                    <Button intent="dismiss" isDisabled={view.isImporting} onPress={on.close}>
                        {view.cancelLabel}
                    </Button>
                    <Button
                        intent="commit"
                        isPending={view.isImporting}
                        isDisabled={view.fileName === null || view.isImporting}
                        onPress={on.confirm}
                    >
                        {view.confirmLabel}
                    </Button>
                </>
            }
        >
            <div className={BODY_CLASS_NAME}>
                <Alert tone="cautionary" title={view.warning} />
                <FileDropzone
                    id="brain-checklist-file"
                    name="checklist"
                    label={view.dropLabel}
                    description={view.dropHint}
                    prompt={view.dropPrompt}
                    accept=".xlsx"
                    hideFileList
                    isDisabled={view.isImporting}
                    onFilesChange={on.pick}
                />
                {view.fileName === null ? null : <Text size="sm">{view.fileName}</Text>}
            </div>
        </Dialog>
    )
}
