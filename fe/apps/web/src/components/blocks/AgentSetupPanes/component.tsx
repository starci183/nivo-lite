import { EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { PaneGridProps } from "@starci/grammar/common"
import type { ReactNode, Ref } from "react"
import { AgentSetupChecklist } from "@/components/composites/AgentSetupChecklist"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupKnowledgeCard } from "@/components/composites/SetupKnowledgeCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import { AgentSetupBand } from "@/components/composites/AgentSetupBand"
import { AgentSetupComposer, type AgentSetupComposerContent } from "@/components/composites/AgentSetupComposer"
import { AgentSetupThread, type AgentSetupThreadContent } from "@/components/composites/AgentSetupThread"
import { SlotView } from "@/components/composites/SlotView"
import type {
    AgentGraphAction,
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
import {
    BranchesBand,
    DetailDrawer,
    GraphCanvasBand,
    GraphHeadBand,
    GraphModeBand,
    InspectorBand,
    ProblemsBand,
    TabsBand,
} from "./graphBands"
/** What the chat draws once the setup is in: the thread and the composer. */
export interface AgentSetupChatContent extends AgentSetupThreadContent, AgentSetupComposerContent {}
/** The words of the panes that do not come from a slot. */
export interface AgentSetupCopy {
    readonly paneLabel: string
    readonly checklistLabel: string
    readonly feedNote: string
    readonly chatLabel: string
    readonly chatTitle: string
    readonly proposalsLabel: string
    readonly confirmLabel: string
    readonly proposalEditLabel: string
    readonly suggestionsLabel: string
    /** "NIVO is asking in the chat", under the current gate. */
    readonly askingLabel: string
}
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
const viewOf = <T,>(labels: SlotLabels, source: ViewSource<T>, render: (data: T, isSkeleton: boolean) => ReactNode) => (
    <SlotView slot={source.slot} placeholder={source.placeholder} labels={labels} onRetry={source.onRetry}>
        {render}
    </SlotView>
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
/** The checklist that must be confirmed before the agent runs, with the run action. */
const SetupBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, sideOf(props), (view, isSkeleton) => (
        <AgentSetupBand
            gates={view.gates}
            checklistLabel={props.props.copy.checklistLabel}
            feedNote={props.props.copy.feedNote}
            isSkeleton={isSkeleton}
        >
            <AgentSetupChecklist view={view} isSkeleton={isSkeleton} copy={props.props.copy} on={props.on} />
            <SetupDraftCard {...view.draft} isSkeleton={isSkeleton} />
            <SetupKnowledgeCard {...view.knowledge} isSkeleton={isSkeleton} />
            <SetupVersionsCard {...view.versions} isSkeleton={isSkeleton} />
        </AgentSetupBand>
    ))
/** The thread of the private chat with NIVO. */
const ThreadBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, chatOf(props), (content, isSkeleton) => (
        <AgentSetupThread content={content} isSkeleton={isSkeleton} copy={props.props.copy} on={props.on} />
    ))
/** The composer of the private chat with NIVO. */
const ComposerBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, chatOf(props), (content, isSkeleton) => (
        <AgentSetupComposer
            content={content}
            isSkeleton={isSkeleton}
            copy={{
                suggestionsLabel: props.props.copy.suggestionsLabel,
                formLabel: props.props.copy.chatTitle,
            }}
            on={props.on}
        />
    ))
/** The notice shown instead of the panes. */
interface NoticePanesProps {
    readonly label: string
    readonly message: string
}
const NoticePanes = (props: NoticePanesProps) => (
    <PaneGrid label={props.label} areas={["notice"]}>
        <Pane area="notice">
            <PaneSection align="center">
                <EmptyNotice message={props.message} />
            </PaneSection>
        </Pane>
    </PaneGrid>
)

/**
 * Draws the Setup tab of an agent as one PaneGrid flush under the tab line. On a laptop the work map of the agent (head, what is
 * wrong with the draft, the graph, then the checklist that must be confirmed before it runs) is the main pane, beside a pane whose tabs are the private chat with
 * NIVO, the detail of the selected node, the proposals and the versions, so a selection replaces the chat and never adds a third
 * column. On a phone four lanes cannot be read: one switch picks the list of branches, the graph, the chat or the proposals, and the
 * detail of a node opens in a drawer. Every band is a PaneSection, so all bands of a pane start at its one content edge.
 */
export const AgentSetupPanesBase = (props: AgentSetupPanesBaseProps) => {
    const { copy, sideTab, threadRef, layout } = props.props
    if (props.props.forbidden !== "") return <NoticePanes label={copy.paneLabel} message={props.props.forbidden} />
    return (
        <>
            <PaneGrid
                label={copy.paneLabel}
                areas={{ base: layout.phoneAreas, medium: layout.mediumAreas }}
                columns={COLUMNS}
                rows={{ base: layout.phoneRows, medium: layout.mediumRows }}
            >
                <Pane area="phonetabs" surface>
                    <PaneSection align="center">
                        <TabsBand {...props} isPhone />
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
                        <ProblemsBand {...props} />
                        <GraphCanvasBand {...props} />
                        <GraphModeBand {...props} />
                        <SetupBand {...props} />
                    </PaneSection>
                </Pane>
                <Pane area="tabs" surface>
                    <PaneSection align="center">
                        <TabsBand {...props} isPhone={false} />
                    </PaneSection>
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
                            <InspectorBand {...props} sideTab={sideTab} />
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
