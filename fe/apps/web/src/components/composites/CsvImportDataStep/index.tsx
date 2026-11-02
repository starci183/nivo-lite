import type { ComponentProps } from "react"
import { Button, FileDropzone, Input, Text, Textarea } from "@starci/grammar/common"
import { CsvImportDocs } from "@/components/branches/CsvImportDocs"
import { CsvImportGrid } from "@/components/branches/CsvImportGrid"
import type { CsvImportGridView } from "@/components/branches/CsvImportGrid"

/** The resolved local source controls of an import, with their existing edit commands. */
interface CsvImportDataStepProps {
    readonly source: "file" | "sheet" | "manual" | "document"
    readonly text: ComponentProps<typeof CsvImportDocs>["text"] &
        Readonly<
            Record<
                | "fileLabel"
                | "filePrompt"
                | "linkSheetLabel"
                | "linkSheetHint"
                | "linkSheetPlaceholder"
                | "pasteLabel"
                | "pasteHint"
                | "pasteUse",
                string
            >
        >
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly fileChosen: string | null
    readonly link: string
    readonly paste: string
    readonly grid: CsvImportGridView
    readonly on: ComponentProps<typeof CsvImportGrid>["on"] & {
        readonly file: (files: ReadonlyArray<File>) => void
        readonly link: (value: string) => void
        readonly paste: (value: string) => void
        readonly applyPaste: () => void
        readonly docs: (files: ReadonlyArray<File>) => void
    }
}

const FileStep = (props: Pick<CsvImportDataStepProps, "text" | "isPending" | "isLoading" | "fileChosen" | "on">) => (
    <>
        <FileDropzone
            label={props.text.fileLabel}
            accept=".csv,.tsv,.txt,.xlsx"
            prompt={props.text.filePrompt}
            isDisabled={props.isPending || props.isLoading}
            hideFileList
            onFilesChange={props.on.file}
        />
        {props.fileChosen === null ? null : <Text size="sm">{props.fileChosen}</Text>}
    </>
)

const SheetStep = (props: Pick<CsvImportDataStepProps, "text" | "isPending" | "isLoading" | "link" | "on">) => (
    <Input
        id="csv-link"
        name="link"
        label={props.text.linkSheetLabel}
        description={props.text.linkSheetHint}
        placeholder={props.text.linkSheetPlaceholder}
        isDisabled={props.isPending}
        value={props.link}
        onValueChange={props.on.link}
        isLoading={props.isLoading}
    />
)

const ManualStep = (
    props: Pick<CsvImportDataStepProps, "text" | "isPending" | "isLoading" | "paste" | "grid" | "on">,
) => (
    <>
        <Textarea
            label={props.text.pasteLabel}
            description={props.text.pasteHint}
            rows={4}
            isDisabled={props.isPending}
            value={props.paste}
            onValueChange={props.on.paste}
            isLoading={props.isLoading}
        />
        <div>
            <Button
                intent="neutral"
                isDisabled={props.isPending || !props.paste.trim()}
                onPress={props.on.applyPaste}
                isLoading={props.isLoading}
            >
                {props.text.pasteUse}
            </Button>
        </div>
        <CsvImportGrid {...props.grid} isDisabled={props.isPending} on={props.on} isLoading={props.isLoading} />
    </>
)

const DocsStep = (props: Pick<CsvImportDataStepProps, "text" | "isPending" | "isLoading" | "link" | "on">) => (
    <CsvImportDocs
        link={props.link}
        isDisabled={props.isPending}
        text={props.text}
        onDocs={props.on.docs}
        onLink={props.on.link}
        isLoading={props.isLoading}
    />
)

/** The existing controls of the selected local data source, kept in one lower drawing owner. */
export const CsvImportDataStep = (props: CsvImportDataStepProps) => {
    const common = { text: props.text, isPending: props.isPending, isLoading: props.isLoading, on: props.on }
    switch (props.source) {
        case "file":
            return <FileStep {...common} fileChosen={props.fileChosen} />
        case "sheet":
            return <SheetStep {...common} link={props.link} />
        case "manual":
            return <ManualStep {...common} paste={props.paste} grid={props.grid} />
        case "document":
            return <DocsStep {...common} link={props.link} />
    }
}
