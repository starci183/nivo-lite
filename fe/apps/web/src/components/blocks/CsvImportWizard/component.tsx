import { Grid, Alert, Input, RadioGroup, Select, Text } from "@starci/grammar/common"

import { CsvImportDataStep } from "@/components/composites/CsvImportDataStep"
import type { CsvImportGridView } from "@/components/branches/CsvImportGrid"
import { CsvImportMap } from "@/components/composites/CsvImportMap"
import type { CsvImportMapView, CsvMapColumn } from "@/components/composites/CsvImportMap"
import { CsvImportRun } from "@/components/composites/CsvImportRun"
import { SlotView } from "@nivo/agent-sdk/workbench"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { WizardFooter, backAction, closeAction, nextAction } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { frameOf, WizardFrame } from "@/components/frames/WizardFrame"
import type { AgentStepView, DataSlot, SlotLabels, WizardNote, WizardResume } from "@/modules/types"

/** The ready drawing with its canonical first-read loading atom. */
type CsvImportWizardDrawLoadingProps = CsvImportWizardBaseProps & { readonly isLoading: boolean }

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
        /** The saved import a resumed wizard reads back; a new one is ready at once. */
        readonly resume: DataSlot<WizardResume>
        /** The sentences of the resume read; its error is why the saved import could not load. */
        readonly slotLabels: SlotLabels
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
        /** Reads the saved import again after the read failed. */
        readonly retry: () => void
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

const SourceStep = ({ props, on, isLoading }: CsvImportWizardDrawLoadingProps) => (
    <>
        <Grid kind="form" columns={2}>
            <Input
                id="csv-name"
                name="name"
                label={props.text.fieldName}
                description={props.text.fieldNameHint}
                isDisabled={props.isPending}
                value={props.form.name}
                onValueChange={on.name}
                isLoading={isLoading}
            />
            {props.source === "document" ? null : (
                <Select
                    label={props.text.fieldEntity}
                    isDisabled={props.isPending}
                    value={props.form.entity}
                    options={[...props.entityOptions]}
                    onValueChange={on.entity}
                    isLoading={isLoading}
                />
            )}
        </Grid>
        <RadioGroup
            label={props.text.fieldSource}
            isDisabled={props.isPending}
            value={props.source}
            onValueChange={on.source}
            options={[...props.sourceOptions]}
            isLoading={isLoading}
        />
    </>
)

const ImportStep = ({ props, on, isLoading }: CsvImportWizardDrawLoadingProps) => (
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
        isLoading={isLoading}
    />
)

/** The data step's body for each source (documents have their own step). */

const StepBody = (base: CsvImportWizardDrawLoadingProps) => {
    const { props, on } = base
    if (props.step === "source") return <SourceStep {...base} isLoading={base.isLoading} />
    if (props.step === "data" || props.step === "docs")
        return (
            <CsvImportDataStep
                source={props.step === "docs" ? "document" : props.source}
                text={props.text}
                isPending={props.isPending}
                isLoading={base.isLoading}
                fileChosen={props.fileChosen}
                link={props.link}
                paste={props.paste}
                grid={props.grid}
                on={on}
            />
        )
    if (props.step === "map")
        return props.map === null ? null : (
            <CsvImportMap {...props.map} isDisabled={props.isPending} on={on} isLoading={base.isLoading} />
        )
    if (props.step === "import") return <ImportStep {...base} isLoading={base.isLoading} />
    return (
        <WizardAgentStep
            {...props.agentStep}
            isDisabled={props.isPending}
            onChange={on.agents}
            isLoading={base.isLoading}
        />
    )
}

/** The wizard a new import starts with: the placeholder drawn while a saved one is read. */
const RESUME_PLACEHOLDER: WizardResume = { isResumed: false }

/**
 * The import wizard in the shared frame: name, kind of rows and source; the data (file, Google Sheets link, typed or pasted table,
 * documents); the column mapping with a preview; the import; the agents that may read it.
 */
export const CsvImportWizardBase = (props: CsvImportWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView
            slot={view.resume}
            placeholder={RESUME_PLACEHOLDER}
            labels={view.slotLabels}
            onRetry={on.retry}
            render={(_resume, isLoading) => (
                <WizardFrame
                    {...frameOf(view)}
                    footer={<WizardFooter actions={actionsOf(props)} isLoading={isLoading} />}
                >
                    {view.resumeLine === null ? null : (
                        <Text size="sm" tone="muted">
                            {view.resumeLine}
                        </Text>
                    )}
                    <StepBody {...props} isLoading={isLoading} />
                    {view.note === null ? null : (
                        <Alert tone={view.note.tone} title={view.note.text} isLoading={isLoading} />
                    )}
                </WizardFrame>
            )}
        />
    )
}
