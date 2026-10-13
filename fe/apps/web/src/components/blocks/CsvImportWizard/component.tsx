import { Alert, Button, FileDropzone, Input, RadioGroup, Select, Text, Textarea } from "@starci/grammar/common"
import { CsvImportDocs } from "@/components/composites/CsvImportDocs"
import { CsvImportGrid } from "@/components/composites/CsvImportGrid"
import type { CsvImportGridView } from "@/components/composites/CsvImportGrid"
import { CsvImportGate } from "@/components/composites/CsvImportGate"
import { CsvImportMap } from "@/components/composites/CsvImportMap"
import type { CsvImportMapView, CsvMapColumn } from "@/components/composites/CsvImportMap"
import { CsvImportRun } from "@/components/composites/CsvImportRun"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView, WizardNote } from "@/modules/types"
import { csvImportWizardClassNames as classNames } from "./classNames"

/** One option of a select. */
interface CsvOption {
    readonly id: string
    readonly label: string
}

/** The plain labels of the import wizard. */
type CsvText = Readonly<
    Record<
        | "back"
        | "next"
        | "close"
        | "done"
        | "readNext"
        | "importNow"
        | "fieldName"
        | "fieldNameHint"
        | "fieldEntity"
        | "fieldSource"
        | "fileLabel"
        | "filePrompt"
        | "linkSheetLabel"
        | "linkSheetHint"
        | "linkSheetPlaceholder"
        | "pasteLabel"
        | "pasteHint"
        | "pasteUse"
        | "docsLabel"
        | "docsPrompt"
        | "docsNote"
        | "docsOr"
        | "linkDocLabel"
        | "linkDocHint"
        | "linkDocPlaceholder"
        | "importScheduleLabel",
        string
    >
>

/** The shortest name an import may have. */
const NAME_MIN = 2

/** Copy, state and commands of the import wizard. */
export interface CsvImportWizardBaseProps {
    readonly props: {
        /** Shown instead of the wizard until the saved import it resumes is known: the loading line, or why it failed. */
        readonly gate: { readonly message: string; readonly failure: string | null } | null
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "source" | "data" | "docs" | "map" | "import" | "agent"
        readonly source: "file" | "sheet" | "manual" | "document"
        /** "Adding data to ..." when resuming an import; null for a new one. */
        readonly resumeLine: string | null
        readonly isResume: boolean
        readonly isPending: boolean
        readonly canGoBack: boolean
        readonly form: { readonly name: string; readonly entity: string; readonly schedule: string }
        readonly link: string
        readonly paste: string
        readonly entityOptions: ReadonlyArray<CsvOption>
        readonly sourceOptions: ReadonlyArray<{
            readonly value: string
            readonly label: string
            readonly description: string
        }>
        readonly scheduleOptions: ReadonlyArray<CsvOption>
        /** "Selected: ..." once a file is chosen; null before. */
        readonly fileChosen: string | null
        readonly docsReady: boolean
        readonly grid: CsvImportGridView
        readonly map: CsvImportMapView | null
        readonly importIntro: string
        /** The import's outcome once it ran; null before. */
        readonly done: { readonly title: string; readonly description: string; readonly skipped: string | null } | null
        readonly note: WizardNote | null
        readonly agentStep: AgentStepView
        readonly text: CsvText
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly read: () => void
        readonly sheet: (sheet: string) => void
        readonly runImport: () => void
        readonly finish: () => void
        readonly close: () => void
        readonly name: (value: string) => void
        readonly entity: (value: string | null) => void
        readonly source: (value: string) => void
        readonly schedule: (value: string | null) => void
        readonly file: (files: ReadonlyArray<File>) => void
        readonly link: (value: string) => void
        readonly paste: (value: string) => void
        readonly applyPaste: () => void
        readonly docs: (files: ReadonlyArray<File>) => void
        readonly column: (column: CsvMapColumn, value: string | null) => void
        readonly rename: (columnId: string, name: string) => void
        readonly cell: (rowId: string, columnId: string, value: string) => void
        readonly addRow: () => void
        readonly removeRow: (rowId: string) => void
        readonly addColumn: () => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: CsvImportWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const back = props.canGoBack ? [backAction(text.back, props.isPending, () => on.go(props.index - 1))] : []
    const leave = props.isResume ? [closeAction(text.close, on.close)] : []
    const forward = () => on.go(props.index + 1)
    if (props.step === "source") {
        const short = props.form.name.trim().length < NAME_MIN
        return [nextAction(text.next, () => on.go(1), { isDisabled: short }), closeAction(text.close, on.close)]
    }
    if (props.step === "data")
        return [nextAction(text.readNext, on.read, { isPending: props.isPending }), ...back, ...leave]
    if (props.step === "docs")
        return [nextAction(text.next, forward, { isDisabled: !props.docsReady }), ...back, ...leave]
    if (props.step === "map") return [nextAction(text.next, () => on.go(3), { isPending: props.isPending }), ...back]
    if (props.step === "import" && props.done !== null) return [nextAction(text.next, forward)]
    if (props.step === "import")
        return [nextAction(text.importNow, on.runImport, { isPending: props.isPending }), ...back]
    return [nextAction(text.done, on.finish, { isPending: props.isPending })]
}

const SourceStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <>
        <div className={classNames.fields}>
            <Input
                id="csv-name"
                name="name"
                label={props.text.fieldName}
                variant="secondary"
                hint={props.text.fieldNameHint}
                isDisabled={props.isPending}
                value={props.form.name}
                onValueChange={on.name}
            />
            {props.source === "document" ? null : (
                <Select
                    label={props.text.fieldEntity}
                    variant="secondary"
                    isDisabled={props.isPending}
                    value={props.form.entity}
                    options={[...props.entityOptions]}
                    onValueChange={on.entity}
                />
            )}
        </div>
        <RadioGroup
            variant="secondary"
            label={props.text.fieldSource}
            isDisabled={props.isPending}
            value={props.source}
            onValueChange={on.source}
            options={[...props.sourceOptions]}
        />
    </>
)

const FileStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <>
        <FileDropzone
            label={props.text.fileLabel}
            accept=".csv,.tsv,.txt,.xlsx"
            prompt={props.text.filePrompt}
            isDisabled={props.isPending}
            hideFileList
            onFilesChange={on.file}
        />
        {props.fileChosen === null ? null : <Text size="sm">{props.fileChosen}</Text>}
    </>
)

const SheetStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <Input
        id="csv-link"
        name="link"
        label={props.text.linkSheetLabel}
        variant="secondary"
        hint={props.text.linkSheetHint}
        placeholder={props.text.linkSheetPlaceholder}
        isDisabled={props.isPending}
        value={props.link}
        onValueChange={on.link}
    />
)

const ManualStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <>
        <Textarea
            label={props.text.pasteLabel}
            description={props.text.pasteHint}
            variant="secondary"
            rows={4}
            isDisabled={props.isPending}
            value={props.paste}
            onValueChange={on.paste}
        />
        <div>
            <Button variant="outline" isDisabled={props.isPending || !props.paste.trim()} onPress={on.applyPaste}>
                {props.text.pasteUse}
            </Button>
        </div>
        <CsvImportGrid {...props.grid} isDisabled={props.isPending} on={on} />
    </>
)

const DocsStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <CsvImportDocs link={props.link} isDisabled={props.isPending} text={props.text} onDocs={on.docs} onLink={on.link} />
)

const ImportStep = ({ props, on }: CsvImportWizardBaseProps) => (
    <CsvImportRun
        intro={props.importIntro}
        schedule={
            props.source === "sheet"
                ? { label: props.text.importScheduleLabel, value: props.form.schedule, options: props.scheduleOptions }
                : null
        }
        isDisabled={props.isPending}
        done={props.done}
        onSchedule={on.schedule}
    />
)

/** The data step's body for each source (documents have their own step). */
const DATA_STEPS = { file: FileStep, sheet: SheetStep, manual: ManualStep, document: DocsStep } as const

const StepBody = (base: CsvImportWizardBaseProps) => {
    const { props, on } = base
    if (props.step === "source") return <SourceStep {...base} />
    if (props.step === "data") {
        const Data = DATA_STEPS[props.source]
        return <Data {...base} />
    }
    if (props.step === "docs") return <DocsStep {...base} />
    if (props.step === "map")
        return props.map === null ? null : <CsvImportMap {...props.map} isDisabled={props.isPending} on={on} />
    if (props.step === "import") return <ImportStep {...base} />
    return <WizardAgentStep {...props.agentStep} isDisabled={props.isPending} onChange={on.agents} />
}

/**
 * The import wizard in the shared frame: name, kind of rows and source; the data (file, Google Sheets link, typed or pasted table,
 * documents); the column mapping with a preview; the import; the agents that may read it.
 */
export const CsvImportWizardBase = (props: CsvImportWizardBaseProps) => {
    const { props: view } = props
    if (view.gate !== null)
        return (
            <CsvImportGate
                message={view.gate.message}
                failure={view.gate.failure}
                closeLabel={view.text.close}
                onClose={props.on.close}
            />
        )
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.resumeLine === null ? null : (
                <Text size="sm" tone="muted">
                    {view.resumeLine}
                </Text>
            )}
            <StepBody {...props} />
            {view.note === null ? null : <Alert tone={view.note.tone} title={view.note.text} />}
        </WizardFrame>
    )
}
