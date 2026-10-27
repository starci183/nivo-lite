import {
    Alert,
    Badge,
    Button,
    Dialog,
    FileDropzone,
    ListRow,
    RadioGroup,
    Select,
    SurfaceListCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { contractImportDialogClassNames as classNames } from "./classNames"

/** One option of a select or a radio group. */
interface ContractImportOption {
    readonly id: string
    readonly label: string
}

/** One column picker: the contract field and the column chosen for it. */
export interface ContractImportColumnView {
    readonly field: string
    readonly label: string
    readonly column: string
}

/** One previewed row, every word already resolved. */
export interface ContractImportRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly problems: ReadonlyArray<{ readonly label: string; readonly tone: BadgeTone }>
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
                {p.summary === null ? null : <PreviewRows {...props} />}
            </div>
        </Dialog>
    )
}

const FileSource = ({ props: p, on }: ContractImportDialogProps) => (
    <>
        <FileDropzone
            label={p.text.fileLabel}
            accept=".csv,.xlsx"
            prompt={p.text.filePrompt}
            isDisabled={p.isPreviewing || p.isImporting}
            hideFileList
            onFilesChange={on.file}
        />
        {p.fileName === null ? null : <Text size="sm">{p.fileName}</Text>}
        {p.sheets === null ? null : (
            <Select
                label={p.text.sheet}
                isDisabled={p.isPreviewing || p.isImporting}
                value={p.sheet}
                options={p.sheets}
                onValueChange={on.sheet}
            />
        )}
    </>
)

const PasteSource = ({ props: p, on }: ContractImportDialogProps) => (
    <>
        <Textarea
            label={p.text.pasteLabel}
            description={p.text.pasteHint}
            rows={5}
            isDisabled={p.isPreviewing || p.isImporting}
            value={p.paste}
            onValueChange={on.paste}
        />
        <div className={classNames.actions}>
            <Button
                intent="neutral"
                size="sm"
                isPending={p.isPreviewing}
                isDisabled={p.isImporting || !p.paste.trim()}
                onPress={on.preview}
            >
                {p.text.preview}
            </Button>
        </div>
    </>
)

const ColumnPickers = ({ props: p, on }: ContractImportDialogProps) => (
    <>
        <Text size="sm" weight="semibold">
            {p.text.mapping}
        </Text>
        <div className={classNames.columns}>
            {(p.columns ?? []).map((column) => (
                <Select
                    key={column.field}
                    label={column.label}
                    isDisabled={p.isPreviewing || p.isImporting}
                    value={column.column}
                    options={p.columnOptions}
                    onValueChange={(value) => on.column(column.field, value)}
                />
            ))}
        </div>
    </>
)

const PreviewRows = ({ props: p }: ContractImportDialogProps) => (
    <>
        <Text size="sm" weight="medium" live="polite">
            {p.summary}
        </Text>
        <SurfaceListCard ariaLabel={p.text.preview}>
            {p.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.title}
                    description={row.description}
                    badges={
                        <>
                            <Badge tone={row.statusTone} isDot>
                                {row.statusLabel}
                            </Badge>
                            {row.problems.map((problem) => (
                                <Badge key={problem.label} tone={problem.tone}>
                                    {problem.label}
                                </Badge>
                            ))}
                        </>
                    }
                />
            ))}
        </SurfaceListCard>
    </>
)

/** Keeps the dialog footer component stable as its fields change. */
const ContractImportDialogFooter = ({ props: p, on }: ContractImportDialogProps) => (
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
