import {
    Alert,
    Badge,
    Button,
    Dialog,
    FileDropzone,
    Cluster,
    EmptyNotice,
    Grid,
    Section,
    Stack,
    RadioGroup,
    Select,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
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
                    onValueChange={(value) => {
                        if (value !== null) on.sheet(value)
                    }}
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
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={p.isPreviewing}
                    isDisabled={p.isImporting || !p.paste.trim()}
                    onPress={on.preview}
                >
                    {p.text.preview}
                </Button>
            </Cluster>
        </>
    )
}

type ColumnPickersProps = ContractImportDialogProps
/** The column pickers: which column of the source fills each contract field. */
const ColumnPickers = (props: ColumnPickersProps) => {
    const { props: p, on } = props
    return (
        <Section title={p.text.mapping} headingLevel={3}>
            <Grid kind="form" columns={1}>
                {(p.columns ?? []).map((column) => (
                    <Select
                        key={column.field}
                        label={column.label}
                        isDisabled={p.isPreviewing || p.isImporting}
                        value={column.column}
                        options={p.columnOptions}
                        onValueChange={(value) => {
                            if (value !== null) on.column(column.field, value)
                        }}
                    />
                ))}
            </Grid>
        </Section>
    )
}

type PreviewRowsProps = { readonly props: ContractImportDialogProps["props"] & { readonly summary: string } }
/** A non-raised preview collection inside the dialog; every problem stays visible beside its original status. */
const PreviewRows = (props: PreviewRowsProps) => {
    const p = props.props
    return (
        <Stack gap="row">
            <Text size="sm" live="polite">
                {p.summary}
            </Text>
            <Section
                kind="list"
                title={p.text.preview}
                headingLevel={3}
                items={p.rows.map((row): ListRowData => ({
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
                    detail:
                        row.problems.length === 0 ? undefined : (
                            <Cluster gap="inline">
                                {row.problems.map((problem) => (
                                    <Badge key={problem.label} tone={problem.tone}>
                                        {problem.label}
                                    </Badge>
                                ))}
                            </Cluster>
                        ),
                }))}
                empty={<EmptyNotice message={p.summary} />}
            />
        </Stack>
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
            <Stack gap="row">
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
                {p.summary === null ? null : <PreviewRows props={{ ...p, summary: p.summary }} />}
            </Stack>
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
