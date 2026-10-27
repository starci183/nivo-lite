import { Alert, Button, Dialog, RadioGroup } from "@starci/grammar/common"
import { contractImportDialogClassNames as classNames } from "./classNames"
import { ColumnPickers, FileSource, PasteSource, PreviewRows } from "./component"
import type { ContractImportRowView } from "./component"

export { contractImportEvents, createContractImportDialog } from "./component"

/** One option of a select or a radio group. */
interface ContractImportOption {
    readonly id: string
    readonly label: string
}

/** One column picker: the contract field and the column chosen for it. */
interface ContractImportColumnView {
    readonly field: string
    readonly label: string
    readonly column: string
}

/** The words and state of the bulk contract import dialog. */
export interface ContractImportDialogProps {
    readonly props: {
        readonly text: Readonly<
            Record<
                | "title"
                | "intro"
                | "close"
                | "cancel"
                | "source"
                | "fileLabel"
                | "filePrompt"
                | "pasteLabel"
                | "pasteHint"
                | "preview"
                | "sheet"
                | "mapping",
                string
            >
        >
        readonly source: string
        readonly sourceOptions: ReadonlyArray<ContractImportOption>
        readonly fileName: string | null
        readonly paste: string
        /** The workbook tabs to pick from; null for a single-tab source. */
        readonly sheets: ReadonlyArray<ContractImportOption> | null
        readonly sheet: string
        /** The column pickers once a preview is in; null before. */
        readonly columns: ReadonlyArray<ContractImportColumnView> | null
        readonly columnOptions: ReadonlyArray<ContractImportOption>
        /** "N rows, M will be imported" once a preview is in. */
        readonly summary: string | null
        readonly rows: ReadonlyArray<ContractImportRowView>
        readonly confirmLabel: string
        readonly canConfirm: boolean
        readonly isPreviewing: boolean
        readonly isImporting: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly source: (value: string) => void
        readonly file: (files: Array<File>) => void
        readonly paste: (value: string) => void
        readonly preview: () => void
        readonly sheet: (value: string | null) => void
        readonly column: (field: string, column: string | null) => void
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** Bulk import of recurring contracts: choose a file or paste a table, check the columns and the rows, then import. */
export const ContractImportDialog = (props: ContractImportDialogProps) => {
    const { props: p, on } = props
    const isBusy = p.isPreviewing || p.isImporting
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={p.text.title}
            closeLabel={p.text.close}
            description={p.text.intro}
            footer={<ContractImportDialogFooter {...props} />}
        >
            <div className={classNames.body}>
                <RadioGroup
                    label={p.text.source}
                    isDisabled={isBusy}
                    value={p.source}
                    onValueChange={on.source}
                    options={p.sourceOptions.map((option) => ({ value: option.id, label: option.label }))}
                />
                {p.source === "paste" ? <PasteSource {...props} /> : <FileSource {...props} />}
                {p.error === null ? null : <Alert tone="negative" title={p.error} />}
                {p.columns === null ? null : <ColumnPickers {...props} />}
                {p.summary === null ? null : <PreviewRows props={p} />}
            </div>
        </Dialog>
    )
}

/** Keeps the dialog footer component stable as its fields change. */
const ContractImportDialogFooter = (props: ContractImportDialogProps) => {
    const { props: p, on } = props
    return (
        <>
            <Button intent="dismiss" onPress={on.close}>
                {p.text.cancel}
            </Button>
            <Button
                intent="commit"
                isPending={p.isImporting}
                isDisabled={p.isImporting || p.isPreviewing || !p.canConfirm}
                onPress={on.confirm}
            >
                {p.confirmLabel}
            </Button>
        </>
    )
}
