import type { ReactNode } from "react"
import { EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBody } from "@/components/frames/PaneBody"
import { AgentRunAiCalls, type AgentRunAiCallsProps } from "@/components/composites/AgentRunAiCalls"
import { AgentRunCanvas } from "@/components/composites/AgentRunCanvas"
import { AgentRunHead, type AgentRunHeadCopy } from "@/components/composites/AgentRunHead"
import { AgentRunDecisionCard, type AgentRunDecisionCopy } from "@/components/composites/AgentRunDecisionCard"
import { AgentRunStepParams, type AgentRunStepParamsCopy } from "@/components/frames/AgentRunStepParams"
import { AgentRunStepsCard } from "@/components/composites/AgentRunStepsCard"
import { nivoIconSource } from "@/components/leaves/Icon"
import type {
    DataSlot,
    PaneGridLayout,
    RunDetailView,
    SlotLabels,
} from "@/modules/types"

/** The words of the page of a run that do not come from the data. */
export interface AgentRunPanesCopy {
    readonly paneLabel: string
    readonly stepsTitle: string
    readonly asideLabel: string
    readonly closeAside: string
    readonly canvasTitle: string
    readonly decision: AgentRunDecisionCopy
    readonly openWorkflow: string
    readonly canvasNote: string
    readonly canvasEmpty: string
    readonly missing: string
    readonly stepEmpty: string
    readonly head: Omit<AgentRunHeadCopy, "isResuming" | "isCancelling">
    readonly params: AgentRunStepParamsCopy
}

/** The page of a run: the copy, the read, whether the phone shows it, and what the person can do. */
export interface AgentRunPanesBaseProps {
    readonly props: {
        readonly copy: AgentRunPanesCopy
        readonly slot: DataSlot<RunDetailView>
        readonly placeholder: RunDetailView
        readonly slotLabels: SlotLabels
        readonly isPhone: boolean
        readonly isMissing: boolean
        readonly isResuming: boolean
        readonly isCancelling: boolean
        readonly isDeciding: boolean
        /** The aside of the selected step is open as a drawer (below the wide width). */
        readonly isAsideOpen: boolean
        /** The head of the aside: the step the person pressed, and its kind. */
        readonly asideHead: { readonly title: string; readonly description: string }
        readonly grid: PaneGridLayout
        /** The AI calls of the run under its graph; left out while there is none (not read yet, not on the back end, or no call). */
        readonly aiCalls: AgentRunAiCallsProps
    }
    readonly on: {
        readonly select: (nodeKey: string) => void
        /** Selects a card pressed on the map and opens the aside with its params. */
        readonly pressStep: (nodeKey: string) => void
        readonly resume: () => void
        readonly cancel: () => void
        readonly decide: (verdict: "approve" | "retry" | "reject") => void
        readonly retry: () => void
        readonly asideOpenChange: (isOpen: boolean) => void
    }
}

/** What the cards of the main pane draw: the page, the run and whether it is the placeholder. */
interface RunCardsProps {
    readonly page: AgentRunPanesBaseProps
    readonly view: RunDetailView
    readonly isLoading: boolean
}

/** The main pane, stacked: the head, the map (the steps on a phone), the decision the run waits on and the AI calls. */
const RunCards = (props: RunCardsProps) => {
    const { copy, isPhone, isResuming, isCancelling, isDeciding } = props.page.props
    const { view, isLoading } = props
    const { on } = props.page
    return (
        <>
            <AgentRunHead
                props={{ copy: { ...copy.head, isResuming, isCancelling }, head: view.head, switches: view.switches, isLoading }}
                on={{ resume: on.resume, cancel: on.cancel }}
            />
            {isPhone ? (
                <AgentRunStepsCard
                    props={{ title: copy.stepsTitle, empty: copy.stepEmpty, steps: view.steps, isLoading }}
                    on={{ select: on.pressStep }}
                />
            ) : (
                <AgentRunCanvas
                    props={{
                        title: view.head.canvasTitle === "" ? copy.canvasTitle : view.head.canvasTitle,
                        fact: view.head.versionLabel,
                        openLabel: copy.openWorkflow,
                        openHref: view.head.workflowHref,
                        note: copy.canvasNote,
                        emptyLabel: copy.canvasEmpty,
                        canvas: view.canvas,
                        isLoading,
                    }}
                    on={{ select: on.pressStep }}
                />
            )}
            {view.decision === null ? null : (
                <AgentRunDecisionCard
                    props={{ copy: copy.decision, decision: view.decision, isDeciding }}
                    on={{ decide: on.decide }}
                />
            )}
            {props.page.props.aiCalls.rows.length === 0 ? null : <AgentRunAiCalls {...props.page.props.aiCalls} />}
        </>
    )
}

/**
 * One run as a workspace page: on the page ground the head, the map painted by the steps and the decision it waits on; beside it, in a
 * white aside (a drawer below the wide width), the step the person pressed with the params it ran with in this run. A phone has no map:
 * its steps are a card.
 */
export const AgentRunPanesBase = (props: AgentRunPanesBaseProps) => {
    const { copy, grid } = props.props
    if (props.props.isMissing)
        return (
            <PaneGrid label={copy.paneLabel} areas={{ base: ["main"], medium: ["main"] }}>
                <Pane area="main" label={copy.paneLabel}>
                    <AgentRunMissing message={copy.missing} />
                </Pane>
            </PaneGrid>
        )
    const part = (render: (view: RunDetailView, isLoading: boolean) => ReactNode) => (
        <SlotView
            render={render}
            onRetry={props.on.retry}
            labels={props.props.slotLabels}
            placeholder={props.props.placeholder}
            slot={props.props.slot}
        />
    )
    return (
            <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="main" scroll content="full" label={copy.paneLabel}>
                    <PaneSection gap="section">
                        {part((view, isLoading) => (
                            <RunCards page={props} view={view} isLoading={isLoading} />
                        ))}
                    </PaneSection>
                </Pane>
                <Pane
                    area="aside"
                    surface
                    scroll
                    label={copy.asideLabel}
                    head={{ title: props.props.asideHead.title, description: props.props.asideHead.description }}
                    collapse="drawer"
                    trigger="none"
                    collapseLabel={copy.asideLabel}
                    closeLabel={copy.closeAside}
                    isOpen={props.props.isAsideOpen}
                    onOpenChange={props.on.asideOpenChange}
                >
                    <PaneBody>
                        {part((view, isLoading) => (
                            <AgentRunStepParams props={{ copy: copy.params, step: view.selected, isLoading }} />
                        ))}
                    </PaneBody>
                </Pane>
            </PaneGrid>
    )
}

/** What the notice of a missing run says. */
interface AgentRunMissingProps {
    readonly message: string
}

/** The page of a run the agent does not have: one notice with a mark and one line. */
export const AgentRunMissing = (props: AgentRunMissingProps) => (
    <PaneSection>
        <EmptyNotice message={props.message} iconSource={nivoIconSource("history", "leading")} />
    </PaneSection>
)
