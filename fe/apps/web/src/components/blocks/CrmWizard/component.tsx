import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Alert, Input, Select, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { DataSlot, SlotLabels, WizardPhases } from "@/modules/types"
import {
    backAction,
    closeAction,
    forwardAction,
    nextAction,
    WizardFooter,
    type WizardAction,
} from "@/components/branches/WizardFooter"
import { CrmOperationsCard } from "@/components/composites/CrmOperationsCard"
import { WizardFrame } from "@/components/frames/WizardFrame"
import type { CrmForm, CrmWizardStep } from "@/hooks/crm-wizard"

/** One row of the pick list. */
interface CrmChoice {
    readonly id: string
    readonly title: string
    readonly subtitle: string
}

/** What a package's template fixes, worded. */
interface CrmTemplateFacts {
    readonly crmId: string
    readonly auth: string
    readonly swaggerPath: string
    readonly baseUrlHint: string
}

/** What saving came to, worded. */
interface CrmResultView {
    readonly isCompatible: boolean
    readonly summary: string
    readonly snapshot: string
    readonly missing: ReadonlyArray<{ readonly id: string; readonly title: string; readonly description: string }>
    /** The operations of the package's document the live document lacks, joined; empty when none. */
    readonly drift: string
}

/** Copy, state and commands of the CRM wizard. */
export interface CrmWizardBaseProps {
    readonly props: {
        readonly boot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly phases: WizardPhases
        readonly index: number
        readonly step: CrmWizardStep
        readonly choices: ReadonlyArray<CrmChoice>
        readonly picked: string | null
        /** The template picked, when one is. */
        readonly template: CrmTemplateFacts | null
        readonly form: CrmForm
        readonly authOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly hasSecret: boolean
        readonly canPick: boolean
        readonly canSave: boolean
        readonly isPending: boolean
        readonly error: string | null
        readonly result: CrmResultView | null
        readonly text: Readonly<
            Record<
                | "next"
                | "back"
                | "close"
                | "save"
                | "done"
                | "pickLabel"
                | "factsTitle"
                | "factCrmId"
                | "factAuth"
                | "factSwagger"
                | "fieldCrmId"
                | "fieldCrmIdHint"
                | "fieldSwaggerUrl"
                | "fieldSwaggerUrlHint"
                | "fieldAuthType"
                | "fieldHeaderName"
                | "fieldBaseUrl"
                | "fieldBaseUrlHint"
                | "fieldSecret"
                | "secretHint"
                | "secretSaved"
                | "resultDone"
                | "resultMissingTitle"
                | "resultMissingEmpty"
                | "resultMissingAlert"
                | "driftTitle",
                string
            >
        >
    }
    readonly on: {
        readonly pick: (id: string) => void
        readonly crmId: (value: string) => void
        readonly baseUrl: (value: string) => void
        readonly swaggerUrl: (value: string) => void
        readonly authType: (value: string | null) => void
        readonly authName: (value: string) => void
        readonly secret: (value: string) => void
        readonly go: (to: number) => void
        readonly save: () => void
        readonly close: () => void
        readonly finish: () => void
    }
}

/** The ready drawing with its canonical first-read loading atom. */
type CrmWizardDrawProps = CrmWizardBaseProps & { readonly isLoading: boolean }

const actionsOf = ({ props, on }: CrmWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text, isPending } = props
    if (props.step === "pick") {
        return [forwardAction(text.next, () => on.go(1), { isDisabled: !props.canPick }), closeAction(text.close, on.close, isPending)]
    }
    if (props.step === "connect") {
        return [
            nextAction(text.save, on.save, { isPending, isDisabled: !props.canSave }),
            backAction(text.back, isPending, () => on.go(0)),
        ]
    }
    return [nextAction(text.done, on.finish, {}), backAction(text.back, false, () => on.go(1))]
}

/** Step "pick": the CRMs the installed packages declare, and "other". */
const PickStep = ({ props, on, isLoading }: CrmWizardDrawProps) => (
    <SurfaceCard
        kind="select"
        sublabel={props.text.pickLabel}
        selectionMode="single"
        value={props.picked}
        onChange={on.pick}
        isLoading={isLoading}
        items={props.choices.map((choice) => ({ ...choice, isDisabled: props.isPending }))}
    />
)

/** The drawing props with the template whose facts are shown. */
interface TemplateFactsProps extends CrmWizardDrawProps {
    readonly template: CrmTemplateFacts
}

/** What a package's template fixes, read only: the CRM id, how the key is sent, where the Swagger is. */
const TemplateFacts = ({ props, template, isLoading }: TemplateFactsProps) => (
    <SurfaceCard
        kind="details"
        label={props.text.factsTitle}
        isLoading={isLoading}
        items={[
            { id: "id", term: props.text.factCrmId, description: template.crmId },
            { id: "auth", term: props.text.factAuth, description: template.auth },
            { id: "swagger", term: props.text.factSwagger, description: template.swaggerPath },
        ]}
    />
)

/** The fields only a CRM no package declares asks for: its id, its Swagger link and how its key is sent. */
const OwnFields = ({ props, on, isLoading }: CrmWizardDrawProps) => (
    <Stack gap="row">
        <Input
            id="crm-id"
            name="crmId"
            label={props.text.fieldCrmId}
            description={props.text.fieldCrmIdHint}
            isDisabled={props.isPending}
            value={props.form.crmId}
            onValueChange={on.crmId}
            isLoading={isLoading}
        />
        <Input
            id="crm-swagger"
            name="swaggerUrl"
            label={props.text.fieldSwaggerUrl}
            description={props.text.fieldSwaggerUrlHint}
            isDisabled={props.isPending}
            value={props.form.swaggerUrl}
            onValueChange={on.swaggerUrl}
            isLoading={isLoading}
        />
        <Select
            label={props.text.fieldAuthType}
            isDisabled={props.isPending}
            options={[...props.authOptions]}
            value={props.form.authType}
            onValueChange={on.authType}
            isLoading={isLoading}
        />
        {props.form.authType === "header" ? (
            <Input
                id="crm-header"
                name="authName"
                label={props.text.fieldHeaderName}
                isDisabled={props.isPending}
                value={props.form.authName}
                onValueChange={on.authName}
                isLoading={isLoading}
            />
        ) : null}
    </Stack>
)

/** Step "connect": the address and the write-only key (empty keeps the stored one). */
const ConnectStep = (draw: CrmWizardDrawProps) => {
    const { props, on, isLoading } = draw
    return (
        <Stack gap="section">
            {props.template === null ? <OwnFields {...draw} /> : <TemplateFacts {...draw} template={props.template} />}
            <Input
                id="crm-base-url"
                name="baseUrl"
                label={props.text.fieldBaseUrl}
                description={props.text.fieldBaseUrlHint}
                placeholder={props.template?.baseUrlHint ?? "https://"}
                isDisabled={props.isPending}
                value={props.form.baseUrl}
                onValueChange={on.baseUrl}
                isLoading={isLoading}
            />
            <Input
                id="crm-secret"
                name="secret"
                kind="password"
                label={props.text.fieldSecret}
                description={props.hasSecret ? props.text.secretSaved : props.text.secretHint}
                isDisabled={props.isPending}
                value={props.form.secret}
                onValueChange={on.secret}
                isLoading={isLoading}
            />
        </Stack>
    )
}

/** Step "result": how many operations the packages need are ready, which are missing, and the drift from the package's document. */
const ResultStep = ({ props, isLoading }: CrmWizardDrawProps) => {
    const result = props.result
    if (result === null) return null
    return (
        <Stack gap="section">
            <Alert
                tone={result.isCompatible ? "affirmative" : "cautionary"}
                title={result.isCompatible ? props.text.resultDone : props.text.resultMissingAlert}
                description={result.summary}
                isLoading={isLoading}
            />
            {result.isCompatible ? null : (
                <CrmOperationsCard
                    label={props.text.resultMissingTitle}
                    rows={result.missing}
                    empty={props.text.resultMissingEmpty}
                    isLoading={isLoading}
                    headingLevel={3}
                />
            )}
            {result.drift === "" ? null : (
                <Alert tone="neutral" title={props.text.driftTitle} description={result.drift} isLoading={isLoading} />
            )}
            <Text size="xs" tone="muted">
                {result.snapshot}
            </Text>
        </Stack>
    )
}

/** The CRM wizard in the shared wizard frame. */
const renderCrmWizard = (props: CrmWizardBaseProps, isLoading: boolean) => {
    const draw: CrmWizardDrawProps = { ...props, isLoading }
    const { props: view } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            phases={view.phases}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} isLoading={isLoading} />}
        >
            {view.step === "pick" ? <PickStep {...draw} /> : null}
            {view.step === "connect" ? <ConnectStep {...draw} /> : null}
            {view.step === "result" ? <ResultStep {...draw} /> : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} isLoading={isLoading} />}
        </WizardFrame>
    )
}

/** Draws the CRM wizard from its actual dependency reads. */
export const CrmWizardBase = (props: CrmWizardBaseProps) => (
    <SlotView
        slot={props.props.boot}
        placeholder={true}
        labels={props.props.slotLabels}
        render={(_ready, isLoading) => renderCrmWizard(props, isLoading)}
    />
)
