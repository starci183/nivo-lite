import { Alert, CheckboxGroup, Input, RadioGroup, Text } from "@starci/grammar/common"
import { SmtpAccountStep } from "@/components/composites/SmtpAccountStep"
import { SmtpGuideStep } from "@/components/composites/SmtpGuideStep"
import { backAction, closeAction, nextAction, startActions, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import type { SmtpAccountView, SmtpGuideView, SmtpOption, SmtpText } from "@/modules/types"

/** Copy, state and commands of the outgoing-email wizard. */
export interface SmtpWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "provider" | "guide" | "account" | "verify"
        readonly presets: ReadonlyArray<SmtpOption>
        readonly presetId: string
        readonly modes: ReadonlyArray<SmtpOption>
        readonly modeId: string
        readonly guide: SmtpGuideView
        readonly account: SmtpAccountView
        readonly isLocked: boolean
        readonly isReady: boolean
        readonly testTo: string
        readonly makeDefault: boolean
        readonly sentNote: string | null
        /** The send button's words: sending while the test goes out. */
        readonly sendLabel: string
        readonly error: string | null
        readonly isPending: boolean
        readonly text: SmtpText
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly save: () => void
        readonly sendTest: () => void
        readonly close: (changed: boolean) => void
        readonly preset: (id: string) => void
        readonly mode: (id: string) => void
        readonly host: (value: string) => void
        readonly port: (value: string) => void
        readonly security: (value: "starttls" | "tls") => void
        readonly field: (name: "fromName" | "fromEmail" | "replyTo" | "user" | "password", value: string) => void
        readonly testTo: (value: string) => void
        readonly makeDefault: (value: boolean) => void
    }
}

const actionsOf = ({ props, on }: SmtpWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "provider")
        return startActions(
            text.next,
            text.close,
            () => on.go(1),
            () => on.close(false),
        )
    if (props.step === "guide") return [nextAction(text.next, () => on.go(2)), back]
    if (props.step === "account") {
        const save = nextAction(text.saveContinue, on.save, {
            isPending: props.isPending,
            isDisabled: !props.isLocked && !props.isReady,
        })
        return props.isLocked ? [save] : [save, back]
    }
    if (props.sentNote !== null) return [nextAction(text.done, () => on.close(true))]
    const send = nextAction(props.sendLabel, on.sendTest, {
        isPending: props.isPending,
        isDisabled: props.testTo.trim() === "",
    })
    return [send, closeAction(text.close, () => on.close(true), props.isPending)]
}

/** Outgoing email in the shared wizard frame: pick where the mailbox lives, a guide, the sender details, one real test email. */
export const SmtpWizardBase = (props: SmtpWizardBaseProps) => {
    const { props: view, on } = props
    const { text } = view
    const busy = view.isPending || view.sentNote !== null
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.step === "provider" ? (
                <>
                    <Text size="sm" tone="muted">
                        {text.chooseHint}
                    </Text>
                    <RadioGroup
                        label={text.stepProvider}
                        isLabelHidden
                        value={view.presetId}
                        onValueChange={on.preset}
                        options={[...view.presets]}
                    />
                    {view.modes.length > 1 ? (
                        <>
                            <Text size="sm" weight="semibold">
                                {text.modeTitle}
                            </Text>
                            <RadioGroup
                                label={text.modeTitle}
                                isLabelHidden
                                value={view.modeId}
                                onValueChange={on.mode}
                                options={[...view.modes]}
                            />
                        </>
                    ) : null}
                </>
            ) : null}
            {view.step === "guide" ? (
                <SmtpGuideStep guide={view.guide} stepsTitle={text.stepsTitle} cautionTitle={text.cautionTitle} />
            ) : null}
            {view.step === "account" ? (
                <SmtpAccountStep
                    account={view.account}
                    text={text}
                    isLocked={view.isLocked}
                    isPending={view.isPending}
                    onField={on.field}
                    onHost={on.host}
                    onPort={on.port}
                    onSecurity={on.security}
                />
            ) : null}
            {view.step === "verify" ? renderSmtpVerification({ text, busy, view, on }) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}

const renderSmtpVerification = ({ text, busy, view, on }: RenderSmtpVerificationInput) => (
    <>
        <Text size="sm" tone="muted">
            {text.notConnectedYet}
        </Text>
        <Input
            id="smtp-test-to"
            name="testTo"
            label={text.testToLabel}
            hint={text.testToHint}
            isDisabled={busy}
            value={view.testTo}
            onValueChange={on.testTo}
        />
        <CheckboxGroup
            label={text.makeDefault}
            isLabelHidden
            isDisabled={busy}
            options={[{ value: "default", label: text.makeDefault, description: text.makeDefaultHint }]}
            value={view.makeDefault ? ["default"] : []}
            onValueChange={(v) => on.makeDefault(v.includes("default"))}
        />
        {view.sentNote === null ? null : <Alert tone="affirmative" title={view.sentNote} />}
    </>
)

type RenderSmtpVerificationInput = {
    text: SmtpText
    busy: boolean
    view: SmtpWizardBaseProps["props"]
    on: SmtpWizardBaseProps["on"]
}
