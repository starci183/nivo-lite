import { Alert, Input, Select, Text, Textarea } from "@starci/grammar/common"
import { OpenApiAuthStep } from "@/components/composites/OpenApiAuthStep"
import { OpenApiPullsStep } from "@/components/composites/OpenApiPullsStep"
import { OpenApiTestStep } from "@/components/composites/OpenApiTestStep"
import { OpenApiToolsStep } from "@/components/composites/OpenApiToolsStep"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView, WizardNote } from "@/modules/types"
import { openApiWizardClassNames as classNames } from "./classNames"

/** A choice of a select. */
type Option = { readonly id: string; readonly label: string }
/** A text field of the address and sign-in step. */
type AuthField = "baseUrl" | "authName" | "authValue" | "authUser" | "authPassword"
/** A setting of a pulled endpoint. */
type PullField = "entity" | "itemsPath" | "idField" | "titleField" | "fixedQuery"
/** One GET operation of the pull list and, when ticked, its settings. */
type PullRow = {
    readonly id: string
    readonly label: string
    readonly description: string | undefined
    readonly isPullable: boolean
    readonly pull: Readonly<Record<PullField, string>> | null
    readonly fixedQueryHint: string | null
}
/** One operation agents may call. */
type ToolOption = { readonly value: string; readonly label: string; readonly description?: string | undefined }

/** Copy, state and commands of the OpenAPI wizard. */
export interface OpenApiWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "source" | "auth" | "pulls" | "tools" | "schedule" | "test" | "agent"
        readonly isPending: boolean
        readonly isTesting: boolean
        readonly error: string | null
        readonly source: {
            readonly name: string
            readonly specUrl: string
            readonly specText: string
            readonly isReady: boolean
            /** The spec was read as typed, so the first button only goes on. */
            readonly isUnchanged: boolean
        }
        readonly authReady: boolean
        readonly auth: {
            readonly values: Readonly<Record<AuthField | "authType", string>>
            readonly options: ReadonlyArray<Option>
            readonly text: Readonly<
                Record<"baseUrl" | "baseUrlHint" | "auth" | "authName" | "authValue" | "user" | "password", string>
            > & { readonly authNameError: string | undefined; readonly secretHint: string | undefined }
        }
        readonly pulls: {
            readonly rows: ReadonlyArray<PullRow>
            readonly entityOptions: ReadonlyArray<Option>
            readonly query: string
            readonly isEmpty: boolean
            readonly tooMany: string | null
            readonly text: Readonly<Record<"hint" | "search" | "empty" | PullField | "itemsPathHint", string>>
        }
        readonly tools: {
            readonly options: ReadonlyArray<ToolOption>
            readonly value: ReadonlyArray<string>
            readonly query: string
            readonly text: Readonly<Record<"hint" | "search" | "empty" | "label", string>>
        }
        readonly schedule: {
            readonly hasPulls: boolean
            readonly options: ReadonlyArray<Option>
            readonly value: string
        }
        readonly test: {
            readonly options: ReadonlyArray<Option>
            readonly value: string | null
            readonly showQuery: boolean
            readonly query: string
            readonly note: WizardNote | null
            readonly fields: string | null
            readonly text: Readonly<Record<"hint" | "empty" | "operation" | "query" | "testing", string>>
        }
        readonly canTest: boolean
        readonly canSave: boolean
        readonly agentStep: AgentStepView
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "save"
                | "loadSpec"
                | "testButton"
                | "name"
                | "nameHint"
                | "specUrl"
                | "specUrlHint"
                | "specText"
                | "specTextHint"
                | "schedule"
                | "scheduleHint",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly close: () => void
        readonly loadSpec: () => void
        readonly save: () => void
        readonly runTest: () => void
        readonly finish: () => void
        readonly name: (value: string) => void
        readonly specUrl: (value: string) => void
        readonly specText: (value: string) => void
        readonly authField: (field: AuthField, value: string) => void
        readonly authType: (value: string | null) => void
        readonly pullQuery: (value: string) => void
        readonly togglePull: (opId: string, on: boolean) => void
        readonly patchPull: (opId: string, field: PullField, value: string | null) => void
        readonly toolQuery: (value: string) => void
        readonly tools: (ids: ReadonlyArray<string>) => void
        readonly schedule: (id: string | null) => void
        readonly testOperation: (id: string | null) => void
        readonly testQuery: (value: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: OpenApiWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text, isPending, index } = props
    const back = backAction(text.back, isPending || props.isTesting, () => on.go(index - 1))
    const next = (isDisabled: boolean) =>
        nextAction(text.next, () => on.go(index + 1), { isDisabled: isDisabled || isPending })
    if (props.step === "source") {
        const goOn = props.source.isUnchanged ? () => on.go(1) : on.loadSpec
        const label = props.source.isUnchanged ? text.next : text.loadSpec
        return [
            nextAction(label, goOn, { isPending, isDisabled: !props.source.isReady }),
            closeAction(text.close, on.close),
        ]
    }
    if (props.step === "auth") return [next(!props.authReady), back]
    if (props.step === "test") {
        const test: WizardAction = {
            id: "test",
            label: text.testButton,
            intent: "alternative",
            isPending: props.isTesting,
            isDisabled: isPending || !props.canTest,
            onPress: on.runTest,
        }
        return [
            nextAction(text.save, on.save, { isPending, isDisabled: props.isTesting || !props.canSave }),
            test,
            back,
        ]
    }
    if (props.step === "agent") return [nextAction(text.done, on.finish, { isPending })]
    return [next(false), back]
}

/** Step "source": the connection name, the spec link or the pasted spec. */
const SourceStep = ({ props, on }: OpenApiWizardBaseProps) => (
    <div className={classNames.column}>
        <Input
            id="oa-name"
            name="name"
            label={props.text.name}
            description={props.text.nameHint}
            isDisabled={props.isPending}
            value={props.source.name}
            onValueChange={on.name}
        />
        <Input
            id="oa-url"
            name="specUrl"
            label={props.text.specUrl}
            description={props.text.specUrlHint}
            isDisabled={props.isPending}
            value={props.source.specUrl}
            onValueChange={on.specUrl}
        />
        <Textarea
            id="oa-text"
            label={props.text.specText}
            description={props.text.specTextHint}
            rows={6}
            isDisabled={props.isPending}
            value={props.source.specText}
            onValueChange={on.specText}
        />
    </div>
)

/** Step "schedule": how often the pulled endpoints are read again. */
const ScheduleStep = ({ props, on }: OpenApiWizardBaseProps) => (
    <div className={classNames.column}>
        <Text size="sm" tone="muted">
            {props.text.scheduleHint}
        </Text>
        <Select
            label={props.text.schedule}
            isDisabled={!props.schedule.hasPulls}
            options={props.schedule.options}
            value={props.schedule.value}
            onValueChange={on.schedule}
        />
    </div>
)

/** Swagger / OpenAPI in the shared wizard frame: spec, auth, pulled operations, agent tools, schedule, test, agents. */
export const OpenApiWizardBase = (props: OpenApiWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.step === "source" ? <SourceStep {...props} /> : null}
            {view.step === "auth" ? (
                <OpenApiAuthStep
                    {...view.auth}
                    isDisabled={view.isPending}
                    onField={on.authField}
                    onAuthType={on.authType}
                />
            ) : null}
            {view.step === "pulls" ? (
                <OpenApiPullsStep
                    {...view.pulls}
                    isDisabled={view.isPending}
                    onQuery={on.pullQuery}
                    onToggle={on.togglePull}
                    onPatch={on.patchPull}
                />
            ) : null}
            {view.step === "tools" ? (
                <OpenApiToolsStep
                    {...view.tools}
                    isDisabled={view.isPending}
                    onQuery={on.toolQuery}
                    onChange={on.tools}
                />
            ) : null}
            {view.step === "schedule" ? <ScheduleStep {...props} /> : null}
            {view.step === "test" ? (
                <OpenApiTestStep
                    {...view.test}
                    isTesting={view.isTesting}
                    onOperation={on.testOperation}
                    onQuery={on.testQuery}
                />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}
