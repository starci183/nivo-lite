import type { DataSlot, SlotLabels, AgentStepView, CopyLabels, GuideScreen, WizardNote } from "@/modules/types"
import { SlotView } from "@nivo/agent-sdk/workbench"
import { Alert, Button, Cluster, Grid, Input, Text } from "@starci/grammar/common"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, nextAction, startActions, WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { WizardFrame } from "@/components/frames/WizardFrame"
import { WizardGuideView } from "@/components/composites/WizardGuideView"

/** Copy, state and commands of the Telegram wizard. */
export interface TelegramWizardBaseProps {
    readonly props: {
        readonly boot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
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
const renderTelegramWizard = (props: TelegramWizardBaseProps, isLoading: boolean) => {
    const { props: view, on } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} isLoading={isLoading} />}
        >
            {view.step === "bot" ? (
                <>
                    <Cluster gap="inline">
                        <Button
                            intent="neutral"
                            href={view.providerHref}
                            target="_blank"
                            rel="noreferrer"
                            isLoading={isLoading}
                        >
                            {view.text.openProvider}
                        </Button>
                    </Cluster>
                    <WizardGuideView
                        screens={view.screens}
                        copy={view.copy}
                        onEdit={() => undefined}
                        onPaste={() => undefined}
                        isLoading={isLoading}
                    />
                </>
            ) : null}
            {view.step === "token" ? (
                <Grid kind="form" columns={1}>
                    <Input
                        id="tg-name"
                        name="name"
                        label={view.text.fieldName}
                        description={view.text.fieldNameHint}
                        isDisabled={view.isPending}
                        value={view.form.name}
                        onValueChange={on.name}
                        isLoading={isLoading}
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
                        isLoading={isLoading}
                    />
                </Grid>
            ) : null}
            {view.step === "check" && view.isChecking ? (
                <Text size="sm" live="polite">
                    {view.text.checking}
                </Text>
            ) : null}
            {view.step === "check" && !view.isChecking && view.check !== null ? (
                <Alert tone={view.check.tone} title={view.check.text} isLoading={isLoading} />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep
                    {...view.agentStep}
                    isDisabled={view.isPending}
                    onChange={on.agents}
                    isLoading={isLoading}
                />
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} isLoading={isLoading} />}
        </WizardFrame>
    )
}

/** Draws the selected wizard's existing ready tree from its actual dependency reads. */
export const TelegramWizardBase = (props: TelegramWizardBaseProps) => (
    <SlotView
        slot={props.props.boot}
        placeholder={true}
        labels={props.props.slotLabels}
        render={(_ready, isLoading) => renderTelegramWizard(props, isLoading)}
    />
)
