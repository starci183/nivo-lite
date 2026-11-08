import { AgentGraphBranchesBand } from "@/components/composites/AgentGraphBranchesBand"
import { AgentGraphDetailDrawer } from "@/components/frames/AgentGraphDetailDrawer"
import { AgentGraphProblems } from "@/components/branches/AgentGraphProblems"
import { AgentGraphCanvas } from "@/components/composites/AgentGraphCanvas"
import { AgentGraphHead } from "@/components/composites/AgentGraphHead"
import { AgentGraphMode } from "@/components/composites/AgentGraphMode"
import { AgentGraphInspector } from "@/components/composites/AgentGraphInspector"
import { AgentGraphTabs } from "@/components/composites/AgentGraphTabs"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentSetupNotice } from "@/components/frames/AgentSetupNotice"
import { Pane, PaneGrid, PaneSection, type PaneGridProps } from "@starci/grammar/common"
import type { ReactNode, Ref } from "react"
import { AgentSetupBand } from "@/components/frames/AgentSetupBand"
import { AgentSetupComposer, type AgentSetupComposerContent } from "@/components/composites/AgentSetupComposer"
import { AgentSetupThread, type AgentSetupThreadContent } from "@/components/composites/AgentSetupThread"
import type {
    AgentGraphAction,
    AgentSetupCopy,
    AgentGraphPanelView,
    AgentGraphLayoutView,
    AgentGraphPhoneView,
    AgentGraphSideTab,
    DataSlot,
    SetupSideView,
    SetupWriteDecision,
    SlotLabels,
} from "@/modules/types"
import type { BrandProposalCommands } from "@/components/leaves/BrandProposalView"
/** What the chat draws once the setup is in: the thread and the composer. */
export interface AgentSetupChatContent extends AgentSetupThreadContent, AgentSetupComposerContent {}
/** The slots, the copy, the notice for anyone who may not set an agent up, and the commands of the setup panes. */
export interface AgentSetupPanesBaseProps {
    readonly props: {
        readonly copy: AgentSetupCopy
        readonly chat: DataSlot<AgentSetupChatContent>
        readonly chatPlaceholder: AgentSetupChatContent
        readonly side: DataSlot<SetupSideView>
        readonly sidePlaceholder: SetupSideView
        /** The action graph of the agent: the map, the answers, the proposals and the history, every word resolved. */
        readonly graph: DataSlot<AgentGraphPanelView>
        readonly graphPlaceholder: AgentGraphPanelView
        /** Which tab of the pane beside the graph shows, and which of the four views the phone shows. */
        readonly sideTab: AgentGraphSideTab
        readonly phoneView: AgentGraphPhoneView
        readonly layout: AgentGraphLayoutView
        readonly slotLabels: SlotLabels
        /** The notice shown instead of the panes; empty when the person may set the agent up. */
        readonly forbidden: string
        /** The thread band, the scroll owner that opens at the newest message. */
        readonly threadRef: Ref<HTMLDivElement>
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly send: () => void
        readonly suggest: (id: string) => void
        readonly decide: (id: string, change: SetupWriteDecision) => void
        readonly attach: (files: ReadonlyArray<File>) => void
        readonly brandField: (name: Parameters<BrandProposalCommands["field"]>[0], value: string) => void
        readonly brandConfirm: (id: string) => void
        readonly brandToggleEdit: (id: string) => void
        readonly brandReject: (id: string) => void
        readonly editText: (value: string) => void
        readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
        readonly startEdit: (gateKey: string, evidence: string) => void
        readonly stopEdit: () => void
        readonly apply: () => void
        readonly open: (href: string) => void
        readonly grants: () => void
        readonly retryChat: () => void
        readonly retrySide: () => void
        readonly retryGraph: () => void
        readonly graph: (action: AgentGraphAction) => void
    }
}
/** The columns: the map takes what is left, the pane beside it a standard width, wider from the wide breakpoint. */
const COLUMNS: PaneGridProps["columns"] = {
    base: ["fill"],
    medium: ["fill", "standard"],
    wide: ["fill", "wide"],
}

/** A read of the panes with the placeholder of its shape and what retrying it does. */
interface ViewSource<T> {
    readonly slot: DataSlot<T>
    readonly placeholder: T
    readonly onRetry: () => void
}
/** Draws a read through the one recipe of a slot's status. */
const viewOf = <T,>(labels: SlotLabels, source: ViewSource<T>, render: (data: T, isLoading: boolean) => ReactNode) => (
    <SlotView
        slot={source.slot}
        placeholder={source.placeholder}
        labels={labels}
        onRetry={source.onRetry}
        render={render}
    />
)
/** The checklist read: the gates, the draft, the knowledge and the versions. */
const sideOf = (base: AgentSetupPanesBaseProps): ViewSource<SetupSideView> => ({
    slot: base.props.side,
    placeholder: base.props.sidePlaceholder,
    onRetry: base.on.retrySide,
})
/** The chat read: the messages, the proposals and the composer. */
const chatOf = (base: AgentSetupPanesBaseProps): ViewSource<AgentSetupChatContent> => ({
    slot: base.props.chat,
    placeholder: base.props.chatPlaceholder,
    onRetry: base.on.retryChat,
})
/** The thread of the private chat with NIVO. */
const ThreadBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, chatOf(props), (content, isLoading) => (
        <AgentSetupThread content={content} isLoading={isLoading} copy={props.props.copy} on={props.on} />
    ))
/** The composer of the private chat with NIVO. */
const ComposerBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, chatOf(props), (content, isLoading) => (
        <AgentSetupComposer
            content={content}
            isLoading={isLoading}
            copy={{
                suggestionsLabel: props.props.copy.suggestionsLabel,
                formLabel: props.props.copy.chatTitle,
            }}
            on={props.on}
        />
    ))

/** Draws a read through the one recipe of a slot's status. */
const graphViewOf = (
    props: AgentSetupPanesBaseProps,
    render: (data: AgentGraphPanelView, isLoading: boolean) => ReactNode,
) => (
    <SlotView
        slot={props.props.graph}
        placeholder={props.props.graphPlaceholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retryGraph}
        render={render}
    />
)
/** The phone branch lane consumes its read in this Base, then draws ready anatomy. */
const BranchesBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphBranchesBand
            branches={view.branches}
            adder={view.adder}
            isLoading={isLoading}
            onAction={props.on.graph}
        />
    ))

/** What is wrong with the draft, in words, with the step to open and the page where a right is given. */
const ProblemsBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view) => (
        <AgentGraphProblems
            view={view.problems}
            onOpen={(value) => props.on.graph({ kind: "openNode", value })}
            onGrants={props.on.grants}
        />
    ))

/** The head of the work map. */
const GraphHeadBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphHead view={view.head} isLoading={isLoading} onPublish={() => props.on.graph({ kind: "publish" })} />
    ))

/** The switch beside the map: does the agent work by the map or only record it. */
const GraphModeBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphMode
            view={view.mode}
            isLoading={isLoading}
            onMode={(value) => props.on.graph({ kind: "mode", value })}
        />
    ))

/** The graph itself. */
const GraphCanvasBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphCanvas
            view={view.canvas}
            isLoading={isLoading}
            onSelect={(value) => props.on.graph({ kind: value === "" ? "select" : "openNode", value })}
        />
    ))

/** The tab line of the pane beside the graph, or the switch of the phone. */
const tabsBandOf = (props: AgentSetupPanesBaseProps, isPhone: boolean) =>
    graphViewOf(props, (view) => (
        <AgentGraphTabs
            label={isPhone ? view.phoneLabel : view.tabsLabel}
            tabs={isPhone ? view.phoneOptions : view.tabs}
            selected={isPhone ? view.phoneView : view.sideTab}
            onSelect={(value) => props.on.graph({ kind: isPhone ? "phoneView" : "sideTab", value })}
        />
    ))

/** The body of the pane beside the graph for a tab that is not the chat. */
const inspectorBandOf = (props: AgentSetupPanesBaseProps, sideTab: AgentGraphSideTab) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphInspector view={view} sideTab={sideTab} isLoading={isLoading} onAction={props.on.graph} />
    ))

/** The phone detail consumes its read in this Base, then draws the same ready drawer. */
const DetailDrawer = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentGraphDetailDrawer view={view} isLoading={isLoading} onAction={props.on.graph} />
    ))

/** The checklist read stays in its connected Base; only ready anatomy is handed down. */
const SetupBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, sideOf(props), (view, isLoading) => (
        <AgentSetupBand
            view={view}
            isLoading={isLoading}
            copy={props.props.copy}
            emptyLabel={props.props.slotLabels.empty}
            onGate={props.on.gate}
            onStartEdit={props.on.startEdit}
            onStopEdit={props.on.stopEdit}
            onEditText={props.on.editText}
            onOpen={props.on.open}
        />
    ))

/**
 * Draws the Setup tab of an agent as one PaneGrid flush under the tab line. On a laptop the work map of the agent (head, the checklist that must be
 * confirmed before it runs, what is wrong with the draft, then the graph and its mode switch) is the main pane, beside a pane whose tabs are the private chat with
 * NIVO, the detail of the selected node, the proposals and the versions, so a selection replaces the chat and never adds a third
 * column. On a phone four lanes cannot be read: one switch picks the list of branches, the graph, the chat or the proposals, and the
 * detail of a node opens in a drawer. Every band is a PaneSection, so all bands of a pane start at its one content edge.
 */
export const AgentSetupPanesBase = (props: AgentSetupPanesBaseProps) => {
    const { copy, sideTab, threadRef, layout } = props.props
    if (props.props.forbidden !== "") return <AgentSetupNotice label={copy.paneLabel} message={props.props.forbidden} />
    return (
        <>
            <PaneGrid
                label={copy.paneLabel}
                areas={{ base: layout.phoneAreas, medium: layout.mediumAreas }}
                columns={COLUMNS}
                rows={{ base: layout.phoneRows, medium: layout.mediumRows }}
            >
                <Pane area="phonetabs" surface>
                    <PaneSection align="center">{tabsBandOf(props, true)}</PaneSection>
                </Pane>
                <Pane area="checklist">
                    <PaneSection scroll={{ label: copy.paneLabel }} gap="section">
                        <SetupBand {...props} />
                        <ProblemsBand {...props} />
                        <GraphModeBand {...props} />
                    </PaneSection>
                </Pane>
                <Pane area="branches">
                    <PaneSection scroll={{ label: copy.paneLabel }}>
                        <BranchesBand {...props} />
                    </PaneSection>
                </Pane>
                <Pane area="graph">
                    <PaneSection align="center">
                        <GraphHeadBand {...props} />
                    </PaneSection>
                    <PaneSection scroll={{ label: copy.paneLabel }} gap="section">
                        <SetupBand {...props} />
                        <ProblemsBand {...props} />
                        <GraphCanvasBand {...props} />
                        <GraphModeBand {...props} />
                    </PaneSection>
                </Pane>
                <Pane area="tabs" surface>
                    <PaneSection align="center">{tabsBandOf(props, false)}</PaneSection>
                </Pane>
                <Pane area="body">
                    {sideTab === "chat" ? (
                        <PaneSection
                            key="chat"
                            scroll={{ label: copy.chatLabel, role: "log", tone: "background", scrollRef: threadRef }}
                        >
                            <ThreadBand {...props} />
                        </PaneSection>
                    ) : (
                        <PaneSection key="inspector" scroll={{ label: copy.paneLabel }} gap="section">
                            {inspectorBandOf(props, sideTab)}
                        </PaneSection>
                    )}
                </Pane>
                <Pane area="foot" surface>
                    <PaneSection>
                        <ComposerBand {...props} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
            <DetailDrawer {...props} />
        </>
    )
}
