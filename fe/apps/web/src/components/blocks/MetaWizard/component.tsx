import { Alert, RadioGroup, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import {
    backAction,
    closeAction,
    nextAction,
    WizardFooter,
    type WizardAction,
} from "@/components/branches/WizardFooter"

import { frameOf, WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView, DataSlot, SlotLabels, WizardNote, WizardResume } from "@/modules/types"
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
        /** The stored connection a resumed wizard reads back; a new one is ready at once. */
        readonly resume: DataSlot<WizardResume>
        readonly slotLabels: SlotLabels
        /** The Pages waiting for the choice. */
        readonly pages: ReadonlyArray<MetaPageChoice>
        readonly pageId: string
        /** The sentence for the Page already chosen; null while none is. */
        readonly chosen: string | null
        readonly agentStep: AgentStepView
        /** The page and Instagram lines of the test step; null before the first check. */
        readonly checked: {
            readonly page: string
            readonly instagram: string
            /** `ok` shows the all-good sentence; `failed` keeps the line-by-line reasons. */
            readonly verdict: "ok" | "failed"
        } | null
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
                | "testAllGood"
                | "testSkipNote",
                string
            >
        >
    }
    readonly on: {
        readonly retry: () => void
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

/** The wizard a new connection starts with: the placeholder drawn while a stored one is read. */
const RESUME_PLACEHOLDER: WizardResume = { isResumed: false }

/** The save or next action of the Page step: save when Pages are listed, continue when one is already chosen. */
const pickStepActions = (
    view: MetaWizardBaseProps["props"],
    text: MetaWizardBaseProps["props"]["text"],
    on: MetaWizardBaseProps["on"],
): ReadonlyArray<WizardAction> => {
    if (view.pages.length > 0) {
        return [nextAction(text.pickSave, on.choose, { isPending: view.isPending, isDisabled: view.pageId === "" })]
    }
    if (view.chosen === null) return []
    return [nextAction(text.next, () => on.go(2))]
}

/** The Page step body: the list, the chosen Page, or the empty sentence. */
const PickStepBody = (props: MetaWizardBaseProps) => {
    const view = props.props
    const text = view.text
    if (view.pages.length > 0) {
        return (
            <RadioGroup
                label={text.pickBody}
                isLabelHidden
                isDisabled={view.isPending}
                value={view.pageId === "" ? null : view.pageId}
                onValueChange={props.on.page}
                options={[...view.pages]}
            />
        )
    }
    if (view.chosen !== null) return <Alert tone="affirmative" title={view.chosen} />
    return (
        <Text size="sm" tone="muted">
            {text.pickNone}
        </Text>
    )
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
                intent: "alternative" as const,
                isNext: true as const,
                onPress: on.login,
                isPending: view.isPending,
            },
            ...(view.pages.length > 0 || view.chosen !== null
                ? [{ id: "next", label: text.next, intent: "alternative" as const, onPress: () => on.go(1) }]
                : []),
            closeAction(text.close, on.close),
        ],
        pick: [...pickStepActions(view, text, on), back],
        agent: [nextAction(text.next, on.saveAgents, { isPending: view.isPending }), back],
        test: [nextAction(text.done, on.done), back],
    }[view.step]
    return (
        <SlotView slot={view.resume} placeholder={RESUME_PLACEHOLDER} labels={view.slotLabels} onRetry={on.retry}>
            {(_resume, isSkeleton) => (
                <WizardFrame {...frameOf(view)} isSkeleton={isSkeleton} actions={actions}>
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
                            <PickStepBody props={view} on={on} />
                        </>
                    ) : null}
                    {view.step === "agent" ? (
                        <>
                            {view.chosen === null ? null : <Alert tone="affirmative" title={text.pickSaved} />}
                            <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
                        </>
                    ) : null}
                    {view.step === "test" ? <MetaTestStep {...props} /> : null}
                    {view.note === null ? null : <Alert tone={view.note.tone} title={view.note.text} />}
                </WizardFrame>
            )}
        </SlotView>
    )
}

/** Labels and commands of the run and repair buttons. */
interface ButtonRowProps {
    readonly run: string
    readonly repair: string
    readonly canRepair: boolean
    readonly isDisabled: boolean
    readonly onRun: () => void
    readonly onRepair: () => void
}

/** The run and repair buttons of the test step. */
const ButtonRow = (props: ButtonRowProps) => (
    <WizardFooter
        actions={[
            { id: "run", label: props.run, intent: "alternative", onPress: props.onRun, isDisabled: props.isDisabled },
            ...(props.canRepair
                ? [
                      {
                          id: "repair",
                          label: props.repair,
                          intent: "alternative" as const,
                          onPress: props.onRepair,
                          isDisabled: props.isDisabled,
                      },
                  ]
                : []),
        ]}
    />
)

/** Renders the MetaTestStep section. */
const MetaTestStep = (props: MetaWizardBaseProps) => {
    const view = props.props
    const text = view.text
    const on = props.on
    return (
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
                    {view.checked.verdict === "ok" ? <Alert tone="affirmative" title={text.testAllGood} /> : null}
                </div>
            )}
            {view.isChecking ? (
                <Text size="sm" weight="medium" live="polite">
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
                    <Text size="sm" weight="medium" live="polite">
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
    )
}
