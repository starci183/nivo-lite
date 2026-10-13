import { Alert, Badge, Button, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, nextAction, startActions, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import { WizardGuideView } from "@/components/composites/WizardGuideView"
import { WizardVerifyStep } from "@/components/composites/WizardVerifyStep"
import type { AgentStepView, CopyLabels, GuideScreen, VerifyHelpView, WizardNote } from "@/modules/types"
import { moneyWizardClassNames as classNames } from "./classNames"

/** Copy, state and commands of the bank and payment wizard. */
export interface MoneyWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "env" | "account" | "follow" | "verify" | "agent"
        /** The sentence shown while an unfinished connection is read back; null once it is. */
        readonly waiting: string | null
        readonly earlyAccess: boolean
        readonly environments: ReadonlyArray<{
            readonly value: string
            readonly label: string
            readonly description: string
        }>
        readonly environment: string
        readonly showEnvHint: boolean
        readonly noTestNote: string | null
        readonly isLocked: boolean
        readonly isTest: boolean
        readonly needsBank: boolean
        readonly bankOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly form: {
            readonly name: string
            readonly bank: string
            readonly account: string
            readonly holder: string
        }
        readonly accountHint: string | undefined
        readonly providerHref: string | null
        readonly screens: ReadonlyArray<GuideScreen>
        readonly copy: CopyLabels
        readonly followLabel: string
        readonly canFollow: boolean
        readonly keysNote: string | null
        readonly verifyHelp: VerifyHelpView | undefined
        readonly received: string | null
        readonly hasCheckFailed: boolean
        readonly agentStep: AgentStepView
        readonly note: WizardNote | null
        readonly isPending: boolean
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "skip"
                | "earlyAccess"
                | "earlyAccessNote"
                | "envHint"
                | "envBadge"
                | "openProvider"
                | "fieldName"
                | "fieldNameHint"
                | "fieldBank"
                | "fieldBankPlaceholder"
                | "fieldAccount"
                | "fieldHolder"
                | "createdLocked"
                | "verifyWaiting"
                | "verifyError",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly create: () => void
        readonly followDone: () => void
        readonly skip: () => void
        readonly finish: () => void
        readonly close: () => void
        readonly environment: (value: "test" | "live") => void
        readonly name: (value: string) => void
        readonly bank: (value: string) => void
        readonly account: (value: string) => void
        readonly holder: (value: string) => void
        readonly edit: (token: string, value: string) => void
        readonly paste: (field: string, value: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: MoneyWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    if (props.step === "env") return startActions(text.next, text.close, () => on.go(1), on.close)
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "account") {
        const missing = props.form.name.trim() === "" && !props.isLocked
        return [nextAction(text.next, on.create, { isPending: props.isPending, isDisabled: missing }), back]
    }
    if (props.step === "follow") {
        return [
            nextAction(props.followLabel, on.followDone, { isPending: props.isPending, isDisabled: !props.canFollow }),
            back,
        ]
    }
    if (props.step === "verify") {
        const skip: WizardAction = { id: "skip", label: text.skip, variant: "outline", onPress: on.skip }
        return [props.received === null ? skip : nextAction(text.next, () => on.go(4)), back]
    }
    return [nextAction(text.done, on.finish, { isPending: props.isPending }), back]
}

const accountOf = ({ props, on }: MoneyWizardBaseProps) => (
    <>
        <div className={classNames.fields}>
            <Input
                id="w-name"
                name="name"
                label={props.text.fieldName}
                variant="secondary"
                hint={props.text.fieldNameHint}
                isDisabled={props.isPending}
                value={props.form.name}
                onValueChange={on.name}
            />
            {props.needsBank ? (
                <>
                    <Select
                        label={props.text.fieldBank}
                        variant="secondary"
                        placeholder={props.text.fieldBankPlaceholder}
                        isDisabled={props.isPending}
                        value={props.form.bank === "" ? null : props.form.bank}
                        options={[...props.bankOptions]}
                        onValueChange={(value) => on.bank(value ?? "")}
                    />
                    <Input
                        id="w-account"
                        name="account"
                        label={props.text.fieldAccount}
                        variant="secondary"
                        isDisabled={props.isPending}
                        value={props.form.account}
                        hint={props.accountHint}
                        onValueChange={on.account}
                    />
                    <Input
                        id="w-holder"
                        name="holder"
                        label={props.text.fieldHolder}
                        variant="secondary"
                        isDisabled={props.isPending}
                        value={props.form.holder}
                        onValueChange={on.holder}
                    />
                </>
            ) : null}
        </div>
        {props.isLocked ? (
            <Text size="xs" tone="muted">
                {props.text.createdLocked}
            </Text>
        ) : null}
    </>
)

/** The bank or payment provider (SePay, payOS, Casso) in the shared wizard frame, one screen per step. */
export const MoneyWizardBase = (props: MoneyWizardBaseProps) => {
    const { props: view, on } = props
    if (view.waiting !== null) {
        return (
            <Text size="sm" tone="muted" live="polite">
                {view.waiting}
            </Text>
        )
    }
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.earlyAccess ? (
                <Alert tone="cautionary" title={view.text.earlyAccess} description={view.text.earlyAccessNote} />
            ) : null}
            {view.step === "env" ? (
                <>
                    {view.showEnvHint ? (
                        <Text size="sm" tone="muted">
                            {view.text.envHint}
                        </Text>
                    ) : null}
                    <RadioGroup
                        variant="secondary"
                        label={view.steps[0] ?? ""}
                        isLabelHidden
                        isDisabled={view.isPending}
                        value={view.environment}
                        onValueChange={(value) => on.environment(value === "test" ? "test" : "live")}
                        options={[...view.environments]}
                    />
                    {view.noTestNote === null ? null : <Alert tone="informative" title={view.noTestNote} />}
                    {view.isLocked ? (
                        <Text size="xs" tone="muted">
                            {view.text.createdLocked}
                        </Text>
                    ) : null}
                </>
            ) : null}
            {view.step === "account" ? accountOf(props) : null}
            {view.step === "follow" ? (
                <>
                    <div className={classNames.buttons}>
                        {view.providerHref === null ? null : (
                            <Button variant="outline" href={view.providerHref} target="_blank" rel="noreferrer">
                                {view.text.openProvider}
                            </Button>
                        )}
                        {view.isTest ? <Badge tone="neutral">{view.text.envBadge}</Badge> : null}
                    </div>
                    <WizardGuideView
                        screens={view.screens}
                        copy={view.copy}
                        isDisabled={view.isPending}
                        onEdit={on.edit}
                        onPaste={on.paste}
                    />
                    {view.keysNote === null ? null : (
                        <Text size="xs" tone="muted">
                            {view.keysNote}
                        </Text>
                    )}
                </>
            ) : null}
            {view.step === "verify" ? (
                <WizardVerifyStep
                    help={view.verifyHelp}
                    received={view.received}
                    waiting={view.text.verifyWaiting}
                    failed={view.hasCheckFailed ? view.text.verifyError : null}
                />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
            ) : null}
            {view.note === null ? null : <Alert tone={view.note.tone} title={view.note.text} />}
        </WizardFrame>
    )
}
