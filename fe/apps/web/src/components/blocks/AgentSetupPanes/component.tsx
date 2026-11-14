import { AgentGraphDetailDrawer } from "@/components/frames/AgentGraphDetailDrawer"
import { AgentGraphProblems } from "@/components/branches/AgentGraphProblems"
import { AgentGraphPublish } from "@/components/composites/AgentGraphPublish"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentSetupNotice } from "@/components/frames/AgentSetupNotice"
import { Pane, PaneGrid, PaneSection, type PaneGridProps } from "@starci/grammar/common"
import type { ReactNode, Ref } from "react"
import { ChatComposerBand } from "@/components/frames/ChatComposerBand"
import { ChatRoomHead } from "@/components/frames/ChatRoomHead"
import { ChatThreadBand } from "@/components/frames/ChatThreadBand"
import { TeamChatMessages } from "@/components/frames/TeamChatMessages"
import { AgentSetupMap, type AgentSetupSteps } from "@/components/composites/AgentSetupMap"
import { WorkflowStepDrawer } from "@/components/composites/WorkflowStepDrawer"
import { AgentSetupNotices } from "@/components/composites/AgentSetupNotices"
import { AgentSetupTrailing } from "@/components/composites/AgentSetupTrailing"
import { AgentSetupUnder, underIdsOf } from "@/components/composites/AgentSetupUnder"
import { AgentSetupUnderstanding } from "@/components/composites/AgentSetupUnderstanding"
import { AgentSetupVersions } from "@/components/composites/AgentSetupVersions"
import { TeamChatComposer } from "@/components/composites/TeamChatComposer"
import { nivoIconSource } from "@/components/leaves/Icon"
import type {
    AgentGraphAction,
    AgentSetupChatContent,
    AgentSetupCopy,
    AgentGraphPanelView,
    DataSlot,
    SetupSideView,
    SetupWriteDecision,
    SlotLabels,
    StepAction,
    TeamChatMessagesCopy,
} from "@/modules/types"

/** The slots, the copy, the notice for anyone who may not set an agent up, and the commands of the setup panes. */
export interface AgentSetupPanesBaseProps {
    readonly props: {
        readonly copy: AgentSetupCopy
        /** The words of the shared chat thread (its bubbles and cards). */
        readonly messagesCopy: TeamChatMessagesCopy
        readonly chat: DataSlot<AgentSetupChatContent>
        /** The same read for the thread alone: empty while no message exists, so the greeting notice stands in the well. */
        readonly thread: DataSlot<AgentSetupChatContent>
        readonly chatPlaceholder: AgentSetupChatContent
        readonly side: DataSlot<SetupSideView>
        readonly sidePlaceholder: SetupSideView
        /** The action graph of the agent: the map, the answers, the proposals and the history, every word resolved. */
        readonly graph: DataSlot<AgentGraphPanelView>
        readonly graphPlaceholder: AgentGraphPanelView
        readonly slotLabels: SlotLabels
        /** The notice shown instead of the panes; empty when the person may set the agent up. */
        readonly forbidden: string
        /** The thread band, the scroll owner that opens at the newest message. */
        readonly threadRef: Ref<HTMLDivElement>
        readonly steps: AgentSetupSteps
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly send: () => void
        readonly suggest: (id: string) => void
        readonly decide: (id: string, change: SetupWriteDecision) => void
        readonly editText: (value: string) => void
        readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
        readonly startEdit: (gateKey: string, evidence: string) => void
        readonly stopEdit: () => void
        readonly open: (href: string) => void
        readonly grants: () => void
        readonly retryChat: () => void
        readonly retrySide: () => void
        readonly retryGraph: () => void
        readonly graph: (action: AgentGraphAction) => void
        readonly step: (action: StepAction) => void
    }
}

const noop = (): void => undefined
/** The columns: the cards take what is left, the setup chat beside them a standard width, wider from the wide breakpoint. */
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
/** The checklist read. */
const sideOf = (base: AgentSetupPanesBaseProps): ViewSource<SetupSideView> => ({
    slot: base.props.side,
    placeholder: base.props.sidePlaceholder,
    onRetry: base.on.retrySide,
})
/** The chat read. */
const chatOf = (base: AgentSetupPanesBaseProps): ViewSource<AgentSetupChatContent> => ({
    slot: base.props.chat,
    placeholder: base.props.chatPlaceholder,
    onRetry: base.on.retryChat,
})
/** The shared thread, or the greeting notice while no message exists: NIVO's cards stand under its replies, the live lines after the last one. */
const ThreadBand = (props: AgentSetupPanesBaseProps) => (
    <SlotView
        slot={props.props.thread}
        placeholder={props.props.chatPlaceholder}
        labels={{ ...props.props.slotLabels, empty: props.props.chatPlaceholder.emptyTitle }}
        emptyDescription={props.props.chatPlaceholder.emptyBody}
        emptyIconSource={nivoIconSource("chat", "leading")}
        onRetry={props.on.retryChat}
        render={(content, isLoading) => (
            <TeamChatMessages
                rows={content.rows}
                copy={props.props.messagesCopy}
                isLoading={isLoading}
                hasOlder={false}
                isLoadingOlder={false}
                decidingId={null}
                decideError={null}
                followsNewest={false}
                onOlder={noop}
                onDecide={noop}
                under={Object.fromEntries(
                    underIdsOf(content).map((id) => [
                        id,
                        <AgentSetupUnder key={id} messageId={id} content={content} copy={props.props.copy} on={props.on} />,
                    ]),
                )}
                trailing={<AgentSetupTrailing content={content} />}
            />
        )}
    />
)

/** The composer of the private chat with NIVO: the shared composer under the small suggestion buttons. */
const ComposerBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, chatOf(props), (content, isLoading) => (
        <ChatComposerBand isWaiting={isLoading} suggestions={content.suggestions} onSuggest={props.on.suggest}>
            <TeamChatComposer
                {...content.composer}
                isLoading={isLoading}
                onDraft={props.on.text}
                onMention={noop}
                onSend={props.on.send}
                onFile={noop}
                onFileClear={noop}
                onReplyClear={noop}
            />
        </ChatComposerBand>
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
/** What is wrong with the draft, in words, with the step to open and the page where a right is given. */
const ProblemsBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view) => (
        <AgentGraphProblems
            view={view.problems}
            onOpen={(value) => props.on.graph({ kind: "openNode", value })}
            onGrants={props.on.grants}
        />
    ))

/** The notices above the cards. */
const NoticesBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, sideOf(props), (view) => <AgentSetupNotices view={view} onOpen={props.on.open} />)

/** What the agent understood, as a title row, three labelled cards and one caption (the status and the publish control of the graph read). */
const UnderstandingBand = (props: AgentSetupPanesBaseProps) =>
    viewOf(props.props.slotLabels, sideOf(props), (view, isLoading) =>
        graphViewOf(props, (graph, isGraphLoading) => (
            <AgentSetupUnderstanding
                view={view}
                isLoading={isLoading}
                copy={props.props.copy}
                status={graph.head.status}
                chip={graph.versions.activeChip}
                publish={
                    graph.head.runningLabel !== "" ? null : (
                        <AgentGraphPublish
                            view={graph.head}
                            isLoading={isGraphLoading}
                            onPublish={() => props.on.graph({ kind: "publish" })}
                        />
                    )
                }
                on={{
                    gate: props.on.gate,
                    startEdit: props.on.startEdit,
                    stopEdit: props.on.stopEdit,
                    editText: props.on.editText,
                }}
            />
        )),
    )

/** The card of the work map: the mode switch in its head, the graph in its body. */
const MapBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentSetupMap
            view={view}
            isLoading={isLoading}
            copy={props.props.copy}
            steps={props.props.steps}
            onMode={(value) => props.on.graph({ kind: "mode", value })}
            onStep={(nodeKey) => props.on.step({ kind: "open", nodeKey })}
        />
    ))

/** The card of the versions: the ones of the graph, the same read as the chip of the understanding card. */
const VersionsBand = (props: AgentSetupPanesBaseProps) =>
    graphViewOf(props, (view, isLoading) => (
        <AgentSetupVersions
            view={view.versions}
            isLoading={isLoading}
            copy={props.props.copy}
            onRestore={(value) => props.on.graph({ kind: "restore", value })}
        />
    ))

/** The bands of the setup chat, drawn by the parts of the chat page: the head, the pink thread well (its notice in the middle), the composer. */
const ChatBands = (props: AgentSetupPanesBaseProps) => (
    <>
        <ChatRoomHead
            head={{
                title: props.props.copy.sideTitle,
                subtitle: props.props.copy.chatSubtitle,
                mark: { kind: "agent", id: "nivo", name: props.props.copy.nivoName, picture: null },
            }}
            isWaiting={false}
        />
        <ChatThreadBand
            label={props.props.copy.chatLabel}
            placement={"isEmpty" in props.props.thread ? "middle" : "foot"}
            isWaiting={false}
            scrollRef={props.props.threadRef}
        >
            <ThreadBand {...props} />
        </ChatThreadBand>
        <ComposerBand {...props} />
    </>
)

/**
 * Draws the Setup tab of an agent in the pink well under the header band (the instance frame draws the breadcrumbs, the title and the
 * tabs). The main column holds the cards, one section step apart: what the agent understands about the work, the work map and the
 * versions. The side column is the setup chat with NIVO as a whole pane (no card), whose proposals are the shared message cards.
 * On a phone the cards stack, the chat last, and the detail of a selected step opens in a drawer.
 */
export const AgentSetupPanesBase = (props: AgentSetupPanesBaseProps) => {
    const { copy } = props.props
    if (props.props.forbidden !== "") return <AgentSetupNotice label={copy.paneLabel} message={props.props.forbidden} />
    return (
        <>
            <PaneGrid
                label={copy.paneLabel}
                areas={{ base: ["main", "side"], medium: ["main side"] }}
                columns={COLUMNS}
                rows={{ base: ["fill", "fill"], medium: ["fill"] }}
            >
                <Pane area="main">
                    <PaneSection scroll={{ label: copy.paneLabel }} gap="section">
                        <NoticesBand {...props} />
                        <ProblemsBand {...props} />
                        <UnderstandingBand {...props} />
                        <MapBand {...props} />
                        <VersionsBand {...props} />
                    </PaneSection>
                </Pane>
                <Pane area="side" content="chat" label={copy.chatLabel}>
                    <ChatBands {...props} />
                </Pane>
            </PaneGrid>
            {graphViewOf(props, (view, isLoading) => (
                <AgentGraphDetailDrawer view={view} isLoading={isLoading} onAction={props.on.graph} />
            ))}
            <WorkflowStepDrawer view={props.props.steps.drawer} onAction={props.on.step} />
        </>
    )
}
