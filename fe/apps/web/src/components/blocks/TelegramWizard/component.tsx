import { Alert, Button, Input, Text } from "@starci/grammar/common"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, nextAction, startActions, WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import { WizardGuideView } from "@/components/composites/WizardGuideView"
import type { AgentStepView, CopyLabels, GuideScreen, WizardNote } from "@/modules/types"
import { telegramWizardClassNames as classNames } from "./classNames"

/** Copy, state and commands of the Telegram wizard. */
export interface TelegramWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "bot" | "token" | "check" | "agent"
        readonly providerHref: string
        readonly screens: ReadonlyArray<GuideScreen>
        readonly copy: CopyLabels
        readonly form: { readonly name: string; readonly token: string }
        readonly check: WizardNote | null
        readonly error: string | null
        readonly isPending: boolean
        readonly isChecking: boolean
        readonly agentStep: AgentStepView
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "retry"
                | "openProvider"
                | "fieldName"
                | "fieldNameHint"
                | "fieldToken"
                | "tokenHint"
                | "checking",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly connect: () => void
        readonly finish: () => void
        readonly retry: () => void
        readonly close: () => void
        readonly name: (value: string) => void
        readonly token: (value: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: TelegramWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "bot") return startActions(text.next, text.close, () => on.go(1), on.close)
    if (props.step === "token") {
        const missing = props.form.name.trim() === "" || props.form.token.trim() === ""
        return [nextAction(text.next, on.connect, { isPending: props.isPending, isDisabled: missing }), back]
    }
    if (props.step === "check") {
        const retry: WizardAction = {
            id: "retry",
            label: text.retry,
            intent: "alternative",
            isDisabled: props.isChecking,
            onPress: on.retry,
        }
        return [nextAction(text.next, () => on.go(3), { isDisabled: props.isChecking }), retry]
    }
    return [nextAction(text.done, on.finish, { isPending: props.isPending })]
}

/** Telegram in the shared wizard frame: BotFather steps, paste the token, check (getMe and webhook info), attach to the agents. */
export const TelegramWizardBase = (props: TelegramWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.step === "bot" ? (
                <>
                    <div className={classNames.buttons}>
                        <Button intent="neutral" href={view.providerHref} target="_blank" rel="noreferrer">
                            {view.text.openProvider}
                        </Button>
                    </div>
                    <WizardGuideView
                        screens={view.screens}
                        copy={view.copy}
                        onEdit={() => undefined}
                        onPaste={() => undefined}
                    />
                </>
            ) : null}
            {view.step === "token" ? (
                <div className={classNames.fields}>
                    <Input
                        id="tg-name"
                        name="name"
                        label={view.text.fieldName}
                        description={view.text.fieldNameHint}
                        isDisabled={view.isPending}
                        value={view.form.name}
                        onValueChange={on.name}
                    />
                    <Input
                        id="tg-token"
                        name="token"
                        label={view.text.fieldToken}
                        kind="password"
                        description={view.text.tokenHint}
                        isDisabled={view.isPending}
                        value={view.form.token}
                        onValueChange={on.token}
                    />
                </div>
            ) : null}
            {view.step === "check" && view.isChecking ? (
                <Text size="sm" live="polite">
                    {view.text.checking}
                </Text>
            ) : null}
            {view.step === "check" && !view.isChecking && view.check !== null ? (
                <Alert tone={view.check.tone} title={view.check.text} />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}
