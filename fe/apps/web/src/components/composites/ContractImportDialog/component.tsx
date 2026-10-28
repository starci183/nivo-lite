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
import { contractImportDialogClassNames as classNames } from "./classNames"
import type { ContractImportDialogProps } from "./index"

type FileSourceProps = ContractImportDialogProps
/** The file source: the drop zone, the chosen file name and, for a workbook, the tab to read. */
const FileSource = (props: FileSourceProps) => {
    const { props: p, on } = props
    return (
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
}

type PasteSourceProps = ContractImportDialogProps
/** The paste source: the pasted table and the command that previews it. */
const PasteSource = (props: PasteSourceProps) => {
    const { props: p, on } = props
    return (
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
}

type ColumnPickersProps = ContractImportDialogProps
/** The column pickers: which column of the source fills each contract field. */
const ColumnPickers = (props: ColumnPickersProps) => {
    const { props: p, on } = props
    return (
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
}

type PreviewRowsProps = Pick<ContractImportDialogProps, "props">
/** The preview: the summary line and each previewed row with its status and problems. */
const PreviewRows = (props: PreviewRowsProps) => {
    const { props: p } = props
    return (
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
