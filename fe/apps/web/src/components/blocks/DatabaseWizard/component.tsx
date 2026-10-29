import { Alert, CheckboxGroup, RadioGroup, Text } from "@starci/grammar/common"
import { DatabaseConnectFields } from "@/components/composites/DatabaseConnectFields"
import type { DatabaseConnectFieldsProps } from "@/components/composites/DatabaseConnectFields"
import { DatabaseTableMapper } from "@/components/composites/DatabaseTableMapper"
import type { DatabaseTableMapperProps } from "@/components/composites/DatabaseTableMapper"
import { SlotView } from "@/components/composites/SlotView"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { frameOf, WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView, DataSlot, SlotLabels, WizardNote, WizardResume } from "@/modules/types"

/** One option of a radio or checkbox list. */
interface DatabaseChoice {
    readonly value: string
    readonly label: string
}

/** One picked table as the table step shows it. */
interface DatabaseMappedView {
    readonly key: string
    readonly id: string
    readonly previewTitle: string
    readonly entity: string
    readonly idColumn: string | null
    readonly titleColumn: string
    readonly updatedColumn: string
    readonly columns: ReadonlyArray<string>
    readonly names: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isOverCap: boolean
    readonly isPreviewing: boolean
    readonly error: string | null
    readonly lines: DatabaseTableMapperProps["props"]["lines"]
}

/** The table step: the tables found, the ones picked and how each is mapped. */
interface DatabaseTablesView {
    readonly hint: string
    readonly label: string
    readonly options: ReadonlyArray<DatabaseChoice>
    readonly picked: ReadonlyArray<string>
    /** The sentence shown while nothing is picked; null once something is. */
    readonly none: string | null
    readonly limit: string
    readonly mapped: ReadonlyArray<DatabaseMappedView>
    readonly entities: DatabaseTableMapperProps["props"]["entities"]
    readonly noneColumn: DatabaseTableMapperProps["props"]["noneColumn"]
    readonly cap: string
    readonly previewing: string
    readonly text: DatabaseTableMapperProps["props"]["text"]
}

/** Copy, state and commands of the database wizard. */
export interface DatabaseWizardBaseProps {
    readonly props: {
        /** The saved connection a resumed wizard reads back; a new one is ready at once. */
        readonly resume: DataSlot<WizardResume>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "connect" | "tables" | "schedule" | "agent"
        readonly connect: DatabaseConnectFieldsProps
        /** The table step; null until a test has listed the tables. */
        readonly tables: DatabaseTablesView | null
        readonly schedule: {
            readonly hint: string
            readonly label: string
            readonly value: string
            readonly options: ReadonlyArray<DatabaseChoice>
        }
        readonly agentStep: AgentStepView
        readonly note: WizardNote | null
        readonly isPending: boolean
        readonly canTest: boolean
        readonly tablesReady: boolean
        readonly text: Readonly<Record<"back" | "next" | "close" | "done" | "save" | "test", string>>
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly test: () => void
        readonly save: () => void
        readonly finish: () => void
        readonly close: () => void
        /** Reads the saved connection again after the read failed. */
        readonly retry: () => void
        readonly tables: (keys: ReadonlyArray<string>) => void
        readonly mapEntity: (key: string, value: string | null) => void
        readonly mapIdColumn: (key: string, value: string | null) => void
        readonly mapOptionalColumn: (key: string, column: "titleColumn" | "updatedColumn", value: string | null) => void
        readonly mapColumns: (key: string, value: ReadonlyArray<string>) => void
        readonly mapPreview: (key: string) => void
        readonly schedule: (key: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

/** The connect step's buttons: test first, then go on (testing again stays possible), or leave. */
const connectActions = ({ props, on }: DatabaseWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const flags = { isPending: props.isPending, isDisabled: !props.canTest }
    if (props.tables === null) return [nextAction(text.test, on.test, flags), closeAction(text.close, on.close)]
    const retest: WizardAction = { id: "test", label: text.test, intent: "alternative", ...flags, onPress: on.test }
    return [nextAction(text.next, () => on.go(1), flags), retest, closeAction(text.close, on.close)]
}

const actionsOf = (base: DatabaseWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { props, on } = base
    const { text } = props
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "connect") return connectActions(base)
    if (props.step === "tables")
        return [nextAction(text.next, () => on.go(2), { isDisabled: !props.tablesReady }), back]
    if (props.step === "schedule") return [nextAction(text.save, on.save, { isPending: props.isPending }), back]
    const leave: WizardAction = { ...back, intent: "dismiss", onPress: () => on.go(2) }
    return [nextAction(text.done, on.finish, { isPending: props.isPending }), leave]
}

/** What the table step draws and reports. */
interface DatabaseTablesStepProps {
    readonly view: DatabaseTablesView
    readonly isPending: boolean
    readonly on: DatabaseWizardBaseProps["on"]
}

/** One mapped table's card props, from the step's shared copy and the table's own state. */
const mapperOf = (step: DatabaseTablesStepProps, table: DatabaseMappedView): DatabaseTableMapperProps => {
    const { view, on } = step
    return {
        props: {
            id: table.id,
            title: table.key,
            entity: table.entity,
            entities: view.entities,
            idColumn: table.idColumn,
            titleColumn: table.titleColumn,
            updatedColumn: table.updatedColumn,
            columns: table.columns,
            names: table.names,
            noneColumn: view.noneColumn,
            cap: table.isOverCap ? view.cap : null,
            isDisabled: step.isPending,
            isPreviewing: table.isPreviewing,
            canPreview: !step.isPending && table.idColumn !== null,
            error: table.error,
            lines: table.lines,
            previewTitle: table.previewTitle,
            text: table.isPreviewing ? { ...view.text, preview: view.previewing } : view.text,
        },
        on: {
            entity: (value) => on.mapEntity(table.key, value),
            id: (value) => on.mapIdColumn(table.key, value),
            title: (value) => on.mapOptionalColumn(table.key, "titleColumn", value),
            updated: (value) => on.mapOptionalColumn(table.key, "updatedColumn", value),
            columns: (value) => on.mapColumns(table.key, value),
            preview: () => on.mapPreview(table.key),
        },
    }
}

/** The table step: tick the tables, map each one, and the per-sync row limit. */
const DatabaseTablesStep = (props: DatabaseTablesStepProps) => (
    <>
        <Text size="sm" tone="muted">
            {props.view.hint}
        </Text>
        <CheckboxGroup
            label={props.view.label}
            isDisabled={props.isPending}
            options={props.view.options}
            value={[...props.view.picked]}
            onValueChange={props.on.tables}
        />
        {props.view.none === null ? null : (
            <Text size="xs" tone="muted">
                {props.view.none}
            </Text>
        )}
        {props.view.mapped.map((table) => (
            <DatabaseTableMapper key={table.key} {...mapperOf(props, table)} />
        ))}
        <Text size="xs" tone="muted">
            {props.view.limit}
        </Text>
    </>
)

/** The wizard a new connection starts with: the placeholder drawn while a saved one is read. */
const RESUME_PLACEHOLDER: WizardResume = { isResumed: false }

/** The note under the step, when there is one. */
const noteOf = (note: WizardNote | null) => (note === null ? null : <Alert tone={note.tone} title={note.text} />)

/** A business database in the shared wizard frame: connect and list the tables, map them, schedule the sync, attach the agents. */
export const DatabaseWizardBase = (props: DatabaseWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView slot={view.resume} placeholder={RESUME_PLACEHOLDER} labels={view.slotLabels} onRetry={on.retry}>
            {(_resume, isSkeleton) => (
                <WizardFrame
                    {...frameOf(view)}
                    isSkeleton={isSkeleton}
                    footer={<WizardFooter actions={actionsOf(props)} isSkeleton={isSkeleton} />}
                >
                    {view.step === "connect" ? <DatabaseConnectFields {...view.connect} /> : null}
                    {view.step === "tables" && view.tables !== null ? (
                        <DatabaseTablesStep view={view.tables} isPending={view.isPending} on={on} />
                    ) : null}
                    {view.step === "schedule" ? (
                        <>
                            <Text size="sm" tone="muted">
                                {view.schedule.hint}
                            </Text>
                            <RadioGroup
                                label={view.schedule.label}
                                isLabelHidden
                                isDisabled={view.isPending}
                                value={view.schedule.value}
                                onValueChange={on.schedule}
                                options={view.schedule.options}
                            />
                        </>
                    ) : null}
                    {view.step === "agent" ? (
                        <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
                    ) : null}
                    {noteOf(view.note)}
                </WizardFrame>
            )}
        </SlotView>
    )
}
