import { Alert } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import {
    WizardFooter,
    backAction,
    nextAction,
    startActions,
    type WizardAction,
} from "@/components/branches/WizardFooter"

import { frameOf, WizardFrame } from "@/components/frames/WizardFrame"
import { WizardVerifyStep } from "@/components/composites/WizardVerifyStep"
import type {
    MoneyWizardCopy,
    MoneyAccountView,
    MoneyEnvironmentView,
    MoneyGuideView,
    AgentStepView,
    DataSlot,
    SlotLabels,
    VerifyHelpView,
    WizardNote,
    WizardResume,
} from "@/modules/types"
import { MoneyAccountStep } from "@/components/composites/MoneyAccountStep"
import { MoneyEnvironmentStep } from "@/components/composites/MoneyEnvironmentStep"
import { MoneyFollowStep } from "@/components/frames/MoneyFollowStep"

/** Copy, state and commands of the bank and payment wizard. */
export interface MoneyWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "env" | "account" | "follow" | "verify" | "agent"
        /** The stored connection a resumed wizard reads back; a new one is ready at once. */
        readonly resume: DataSlot<WizardResume>
        readonly slotLabels: SlotLabels
        readonly earlyAccess: boolean
        readonly environmentStep: MoneyEnvironmentView
        readonly accountStep: MoneyAccountView
        readonly guideStep: MoneyGuideView
        readonly followLabel: string
        readonly canFollow: boolean
        readonly verifyHelp: VerifyHelpView | undefined
        readonly received: string | null
        readonly hasCheckFailed: boolean
        readonly agentStep: AgentStepView
        readonly note: WizardNote | null
        readonly isPending: boolean
        readonly text: MoneyWizardCopy
    }
    readonly on: {
        readonly retry: () => void
        readonly go: (to: number) => void
        readonly create: () => void
        readonly followDone: () => void
        readonly checkLater: () => void
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

/** The wizard a new connection starts with: the placeholder drawn while a stored one is read. */
const RESUME_PLACEHOLDER: WizardResume = { isResumed: false }

const actionsOf = ({ props, on }: MoneyWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    if (props.step === "env") return startActions(text.next, text.close, () => on.go(1), on.close)
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "account") {
        const missing = props.accountStep.form.name.trim() === "" && !props.accountStep.isLocked
        return [nextAction(text.next, on.create, { isPending: props.isPending, isDisabled: missing }), back]
    }
    if (props.step === "follow") {
        return [
            nextAction(props.followLabel, on.followDone, { isPending: props.isPending, isDisabled: !props.canFollow }),
            back,
        ]
    }
    if (props.step === "verify") {
        const checkLater: WizardAction = {
            id: "checkLater",
            label: text.checkLater,
            intent: "dismiss",
            onPress: on.checkLater,
        }
        return [props.received === null ? checkLater : nextAction(text.next, () => on.go(4)), back]
    }
    return [nextAction(text.done, on.finish, { isPending: props.isPending }), back]
}

/** The bank or payment provider (SePay, payOS, Casso) in the shared wizard frame, one screen per step. */
export const MoneyWizardBase = (props: MoneyWizardBaseProps) => {
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
                    <MoneyStepBody {...props} isLoading={isLoading} />
                </WizardFrame>
            )}
        />
    )
}

/** The wizard and whether its resume read is still on its way. */
interface MoneyWizardStepProps extends MoneyWizardBaseProps {
    readonly isLoading: boolean
}

/** Draws the step the wizard is on, with the note under it. */
const MoneyStepBody = (props: MoneyWizardStepProps) => {
    const { props: view, on } = props
    const { isLoading } = props
    return (
        <>
            {view.earlyAccess ? (
                <Alert
                    tone="cautionary"
                    title={view.text.earlyAccess}
                    description={view.text.earlyAccessNote}
                    isLoading={props.isLoading}
                />
            ) : null}
            {view.step === "env" ? (
                <MoneyEnvironmentStep
                    {...view.environmentStep}
                    label={view.steps[0] ?? ""}
                    isLocked={view.accountStep.isLocked}
                    isPending={view.isPending}
                    isLoading={isLoading}
                    text={view.text}
                    onChange={on.environment}
                />
            ) : null}
            {view.step === "account" ? (
                <MoneyAccountStep
                    {...view.accountStep}
                    isPending={view.isPending}
                    isLoading={isLoading}
                    text={view.text}
                    onName={on.name}
                    onBank={on.bank}
                    onAccount={on.account}
                    onHolder={on.holder}
                />
            ) : null}
            {view.step === "follow" ? (
                <MoneyFollowStep
                    {...view.guideStep}
                    isPending={view.isPending}
                    isLoading={isLoading}
                    text={view.text}
                    onEdit={on.edit}
                    onPaste={on.paste}
                />
            ) : null}
            {view.step === "verify" ? (
                <WizardVerifyStep
                    help={view.verifyHelp}
                    received={view.received}
                    waiting={view.text.verifyWaiting}
                    failed={view.hasCheckFailed ? view.text.verifyError : null}
                    isLoading={props.isLoading}
                />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep
                    {...view.agentStep}
                    isDisabled={view.isPending}
                    onChange={on.agents}
                    isLoading={props.isLoading}
                />
            ) : null}
            {view.note === null ? null : (
                <Alert tone={view.note.tone} title={view.note.text} isLoading={props.isLoading} />
            )}
        </>
    )
}
