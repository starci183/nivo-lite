import { FileDropzone, Input, Text } from "@starci/grammar/common"

/** What the documents step draws and reports. */
interface CsvImportDocsProps {
    /** The Google Docs link typed so far. */
    readonly link: string
    readonly isDisabled: boolean
    readonly text: Readonly<
        Record<
            "docsLabel" | "docsPrompt" | "docsNote" | "docsOr" | "linkDocLabel" | "linkDocHint" | "linkDocPlaceholder",
            string
        >
    >
    readonly onDocs: (files: ReadonlyArray<File>) => void
    readonly onLink: (value: string) => void
}

/** The documents step: drop Word, PDF, text or Markdown files, or give a Google Docs link instead. */
export const CsvImportDocs = (props: CsvImportDocsProps) => (
    <>
        <FileDropzone
            label={props.text.docsLabel}
            accept=".docx,.pdf,.txt,.md"
            multiple
            prompt={props.text.docsPrompt}
            description={props.text.docsNote}
            isDisabled={props.isDisabled}
            onFilesChange={props.onDocs}
        />
        <Text size="sm" tone="muted">
            {props.text.docsOr}
        </Text>
        <Input
            id="csv-doc-link"
            name="doclink"
            label={props.text.linkDocLabel}
            hint={props.text.linkDocHint}
            placeholder={props.text.linkDocPlaceholder}
            isDisabled={props.isDisabled}
            value={props.link}
            onValueChange={props.onLink}
        />
    </>
)
