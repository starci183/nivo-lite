import { Alert, RadioGroup, Spinner, Text } from "@starci/grammar/common"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView, WizardNote } from "@/modules/types"
import { metaWizardClassNames as classNames } from "./classNames"

/** One option of the Page list. */
export interface MetaPageChoice {
    readonly value: string
    readonly label: string
    readonly description: string
}

/** Copy, state and commands of the Meta wizard. */
export interface MetaWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "connect" | "pick" | "agent" | "test"
        /** The sentence shown while an unfinished connection is read back; null once it is. */
        readonly waiting: string | null
        /** The Pages waiting for the choice. */
        readonly pages: ReadonlyArray<MetaPageChoice>
        readonly pageId: string
        /** The sentence for the Page already chosen; null while none is. */
        readonly chosen: string | null
        readonly agentStep: AgentStepView
        /** The page and Instagram lines of the test step; null before the first check. */
        readonly checked: { readonly page: string; readonly instagram: string; readonly allGood: string | null } | null
        readonly lines: ReadonlyArray<{
            readonly key: string
            readonly tone: WizardNote["tone"]
            readonly text: string
        }>
        /** The sentence for the first message that arrived; null while none has. */
        readonly received: string | null
        readonly canRepair: boolean
        readonly hasConnection: boolean
        readonly note: WizardNote | null
        readonly isPending: boolean
        readonly isChecking: boolean
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "connectBody"
                | "connectScopes"
                | "devNote"
                | "connect"
                | "reconnect"
                | "pickBody"
                | "pickNone"
                | "pickSave"
                | "pickSaved"
                | "testIntro"
                | "testRun"
                | "testRepair"
                | "testWorking"
                | "testWaiting"
                | "testSkipNote",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly login: () => void
        readonly choose: () => void
        readonly saveAgents: () => void
        readonly runCheck: (repair: boolean) => void
        readonly close: () => void
        readonly done: () => void
        readonly page: (pageId: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

/** Draws Facebook and Instagram in the shared wizard frame: login, pick the Page, attach the agents, test. */
export const MetaWizardBase = (props: MetaWizardBaseProps) => {
    const view = props.props
    const text = view.text
    const on = props.on
    const back = backAction(text.back, view.isPending, () => on.go(view.index - 1))
    const actions: ReadonlyArray<WizardAction> = {
        connect: [
            {
                id: "login",
                label: view.hasConnection ? text.reconnect : text.connect,
                variant: "primary" as const,
                onPress: on.login,
                isPending: view.isPending,
            },
            ...(view.pages.length > 0 || view.chosen !== null
                ? [{ id: "next", label: text.next, variant: "outline" as const, onPress: () => on.go(1) }]
                : []),
            closeAction(text.close, on.close),
        ],
        pick: [
            ...(view.pages.length > 0
                ? [nextAction(text.pickSave, on.choose, { isPending: view.isPending, isDisabled: view.pageId === "" })]
                : view.chosen === null
                  ? []
                  : [nextAction(text.next, () => on.go(2))]),
            back,
        ],
        agent: [nextAction(text.next, on.saveAgents, { isPending: view.isPending }), back],
        test: [nextAction(text.done, on.done), back],
    }[view.step]
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
            footer={<WizardFooter actions={actions} />}
        >
            {view.step === "connect" ? (
                <div className={classNames.copy}>
                    <Text size="sm">{text.connectBody}</Text>
                    <Text size="sm" tone="muted">
                        {text.connectScopes}
                    </Text>
                    <Alert tone="informative" title={text.devNote} />
                </div>
            ) : null}
            {view.step === "pick" ? (
                <>
                    <Text size="sm">{text.pickBody}</Text>
                    {view.pages.length > 0 ? (
                        <RadioGroup
                            variant="secondary"
                            label={text.pickBody}
                            isLabelHidden
                            isDisabled={view.isPending}
                            value={view.pageId === "" ? null : view.pageId}
                            onValueChange={on.page}
                            options={[...view.pages]}
                        />
                    ) : view.chosen !== null ? (
                        <Alert tone="affirmative" title={view.chosen} />
                    ) : (
                        <Text size="sm" tone="muted">
                            {text.pickNone}
                        </Text>
                    )}
                </>
            ) : null}
            {view.step === "agent" ? (
                <>
                    {view.chosen === null ? null : <Alert tone="affirmative" title={text.pickSaved} />}
                    <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
                </>
            ) : null}
            {view.step === "test" ? (
                <>
                    <Text size="sm">{text.testIntro}</Text>
                    {view.checked === null ? null : (
                        <div className={classNames.copy}>
                            <Text size="sm" weight="semibold">
                                {view.checked.page}
                            </Text>
                            <Text size="xs" tone="muted">
                                {view.checked.instagram}
                            </Text>
                            {view.lines.map((line) => (
                                <Alert key={line.key} tone={line.tone} title={line.text} />
                            ))}
                            {view.checked.allGood === null ? null : (
                                <Alert tone="affirmative" title={view.checked.allGood} />
                            )}
                        </div>
                    )}
                    {view.isChecking ? (
                        <Text size="sm" weight="medium" startContent={<Spinner size="sm" label={text.testWorking} />}>
                            {text.testWorking}
                        </Text>
                    ) : null}
                    <div className={classNames.buttons}>
                        <ButtonRow
                            run={text.testRun}
                            repair={text.testRepair}
                            canRepair={view.canRepair}
                            isDisabled={view.isChecking}
                            onRun={() => on.runCheck(false)}
                            onRepair={() => on.runCheck(true)}
                        />
                    </div>
                    {view.received === null ? (
                        <>
                            <Text
                                size="sm"
                                weight="medium"
                                startContent={<Spinner size="sm" label={text.testWaiting} />}
                            >
                                {text.testWaiting}
                            </Text>
                            <Text size="xs" tone="muted">
                                {text.testSkipNote}
                            </Text>
                        </>
                    ) : (
                        <Alert tone="affirmative" title={view.received} />
                    )}
                </>
            ) : null}
            {view.note === null ? null : <Alert tone={view.note.tone} title={view.note.text} />}
        </WizardFrame>
    )
}

/** The run and repair buttons of the test step. */
const ButtonRow = (props: {
    readonly run: string
    readonly repair: string
    readonly canRepair: boolean
    readonly isDisabled: boolean
    readonly onRun: () => void
    readonly onRepair: () => void
}) => (
    <WizardFooter
        actions={[
            { id: "run", label: props.run, variant: "outline", onPress: props.onRun, isDisabled: props.isDisabled },
            ...(props.canRepair
                ? [
                      {
                          id: "repair",
                          label: props.repair,
                          variant: "outline" as const,
                          onPress: props.onRepair,
                          isDisabled: props.isDisabled,
                      },
                  ]
                : []),
        ]}
    />
)
