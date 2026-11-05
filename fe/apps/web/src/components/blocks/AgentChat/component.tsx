import { useState } from "react"
import { Page, Pane, PaneGrid, PaneSection, Tabs, type BreadcrumbItem } from "@starci/grammar/common"
import { AgentChatComposer, type AgentChatComposerProps } from "@/components/composites/AgentChatComposer"
import { AgentChatEmpty, type AgentChatEmptyProps } from "@/components/composites/AgentChatEmpty"
import { AgentChatHeader, type AgentChatHeaderProps } from "@/components/composites/AgentChatHeader"
import { AgentChatMessages, type AgentChatMessagesProps } from "@/components/composites/AgentChatMessages"
import { AgentChatRailHead } from "@/components/composites/AgentChatRailHead"
import { AgentChatRailList, type AgentChatRailRow } from "@/components/composites/AgentChatRailList"
import { AgentChatThread, type AgentChatThreadProps } from "@/components/composites/AgentChatThread"
import { AgentChatRail } from "@/components/frames/AgentChatRail"
import { PromoWelcomeBand, type PromoWelcomeBandProps } from "@/components/composites/PromoWelcomeBand"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Which channel the owner is looking at. */
export type AgentChatTab = "test" | "customer"

/** What the thread area needs to know about the open conversation. */
interface ThreadView {
    readonly hasSelection: boolean
}

/** The channel tabs: their label and the items, or none when the agent has no customer channel. */
interface ChannelTabsView {
    readonly label: string
    readonly selectedKey: AgentChatTab
    readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** The data the presentational chat surface draws, already resolved. */
export interface AgentChatViewProps {
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly pageLabel: string
    /** The agent is not in yet: the new-conversation control waits while the frame, labels and composer stay. */
    readonly isStartDisabled: boolean
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    readonly railTitle: string
    /** The title of the list head: empty on a phone, where the drawer already carries the title. */
    readonly railHeadTitle: string
    /** The control that closes the conversation rail where it is a drawer (the head opens it). */
    readonly historyCloseLabel: string
    readonly newLabel: string
    readonly isStarting: boolean
    readonly railSlot: DataSlot<ReadonlyArray<AgentChatRailRow>>
    readonly railLabels: SlotLabels
    /** The first read of the agent and its conversations is not in: every region draws its waiting shape together. */
    readonly isWaiting: boolean
    readonly header: Omit<
        AgentChatHeaderProps,
        "glyph" | "module" | "seed" | "onBack" | "onHistory" | "onTakeover" | "onOpenLead"
    >
    readonly channelTabs: ChannelTabsView | null
    /** A conversation is open (or the first read waits): the composer is drawn; with none open the greeting carries the one action. */
    readonly hasConversation: boolean
    readonly threadSlot: DataSlot<ThreadView>
    readonly threadLabels: SlotLabels
    readonly thread: Omit<AgentChatThreadProps, "messages"> & { readonly label: string }
    readonly welcome: Omit<PromoWelcomeBandProps, "onClose"> | null
    readonly messages: Omit<AgentChatMessagesProps, "glyph" | "module" | "seed" | "isLoading">
    readonly empty: Omit<AgentChatEmptyProps, "glyph" | "module" | "seed" | "onVisitorName" | "onPrompt" | "onStart">
    readonly composer: Omit<AgentChatComposerProps, "onDraft" | "onFile" | "onFileClear" | "onPrompt" | "onSend">
}

/** What the surface asks of its owner. */
export interface AgentChatHandlers {
    readonly retryRail: () => void
    readonly retryThread: () => void
    readonly toggleTakeover: () => void
    readonly back: () => void
    readonly tab: (tab: AgentChatTab) => void
    readonly draft: (value: string) => void
    readonly file: (file: File) => void
    readonly fileClear: () => void
    readonly visitorName: (value: string) => void
    readonly send: (prompt?: string) => void
    readonly start: () => void
    readonly select: (conversationId: string, kind: AgentChatTab) => void
    readonly openLead: () => void
    readonly closeWelcome: () => void
}

/** Props for {@link AgentChatBase}. */
export interface AgentChatBaseProps {
    readonly props: AgentChatViewProps
    readonly on: AgentChatHandlers
}

const NO_ROWS: ReadonlyArray<AgentChatRailRow> = []
const SKELETON_THREAD: ThreadView = { hasSelection: true }

/** The content of the open conversation: its messages, or the greeting when none is open. */
const Thread = (props: AgentChatBaseProps) => (
    <AgentChatThread
        scrollKey={props.props.thread.scrollKey}
        handoff={props.props.thread.handoff}
        takenOverNotice={props.props.thread.takenOverNotice}
        messages={
            <>
                {props.props.welcome === null ? null : (
                    <PromoWelcomeBand {...props.props.welcome} onClose={props.on.closeWelcome} />
                )}
                <SlotView
                    slot={props.props.threadSlot}
                    placeholder={SKELETON_THREAD}
                    labels={props.props.threadLabels}
                    onRetry={props.on.retryThread}
                    render={(view, isLoading) =>
                        view.hasSelection ? (
                            <AgentChatMessages
                                {...props.props.messages}
                                avatarUrl={props.props.avatarUrl}
                                seed={props.props.seed}
                                isLoading={isLoading}
                            />
                        ) : (
                            <AgentChatEmpty
                                {...props.props.empty}
                                avatarUrl={props.props.avatarUrl}
                                seed={props.props.seed}
                                onVisitorName={props.on.visitorName}
                                onPrompt={props.on.send}
                                onStart={props.on.start}
                            />
                        )
                    }
                />
            </>
        }
    />
)

/** The surface and the control that opens the conversation drawer. */
interface HeadProps extends AgentChatBaseProps {
    readonly onHistory: () => void
}

/** The header of the open conversation, with the control that opens the conversation drawer of a phone. */
const Head = (props: HeadProps) => (
    <AgentChatHeader
        {...props.props.header}
        avatarUrl={props.props.avatarUrl}
        seed={props.props.seed}
        onBack={props.on.back}
        onHistory={props.onHistory}
        onTakeover={props.on.toggleTakeover}
        onOpenLead={props.on.openLead}
    />
)

/** The tabs and what picking one does. */
interface ChannelTabsProps {
    readonly tabs: ChannelTabsView
    readonly onTab: (tab: AgentChatTab) => void
}

/** The channel tabs of the conversation list; none when the agent has no customer channel. */
const ChannelTabs = (props: ChannelTabsProps) => (
    <Tabs
        label={props.tabs.label}
        selectedKey={props.tabs.selectedKey}
        items={[...props.tabs.items]}
        onSelect={(key) => props.onTab(key === "customer" ? "customer" : "test")}
        kind="filter"
        inset="none"
        labelVisibility="always"
    />
)

/** The rail the list draws and what picking a row does. */
interface RailListProps {
    readonly view: AgentChatViewProps
    readonly onPick: (id: string, kind: AgentChatTab) => void
    readonly onRetry: () => void
}

/** The conversations of the rail. */
const RailList = (props: RailListProps) => (
    <SlotView
        slot={props.view.railSlot}
        placeholder={NO_ROWS}
        labels={props.view.railLabels}
        onRetry={props.onRetry}
        render={(rows, isLoading) => (
            <AgentChatRailList
                label={props.view.railTitle}
                rows={rows}
                avatarUrl={props.view.avatarUrl}
                seed={props.view.seed}
                isLoading={isLoading}
                onPick={props.onPick}
            />
        )}
    />
)

/** The areas and tracks: a phone shows the conversation alone (the list is a drawer); from 48rem the list stands beside it. */
const AREAS = {
    base: ["head", "thread", "composer"],
    medium: ["list head", "list thread", "list composer"],
}
const COLUMNS = { base: ["fill"], medium: ["wide", "fill"] } as const
const ROWS = { base: ["auto", "fill", "auto"], medium: ["auto", "fill", "auto"] } as const

/** The surface and what picking a conversation does. */
interface RailPaneProps extends AgentChatBaseProps {
    readonly onPick: (id: string, kind: AgentChatTab) => void
}

/** The conversation list: its head band with the way to start one, the channel tabs and the rows. */
const RailPane = (props: RailPaneProps) => {
    const view = props.props
    return (
        <AgentChatRail
            label={view.railTitle}
            head={
                <AgentChatRailHead
                    title={view.railHeadTitle}
                    newLabel={view.newLabel}
                    isDisabled={view.isStartDisabled}
                    isStarting={view.isStarting}
                    onStart={props.on.start}
                />
            }
            tabs={view.channelTabs === null ? null : <ChannelTabs tabs={view.channelTabs} onTab={props.on.tab} />}
        >
            <RailList view={view} onPick={props.onPick} onRetry={props.on.retryRail} />
        </AgentChatRail>
    )
}

/**
 * Presentational agent chat, Zalo style, as panes under the breadcrumb trail: the conversation list at the left (a drawer on a
 * phone, opened from the head), and beside it the head band, the thread and the composer pinned under it.
 */
export const AgentChatBase = (props: AgentChatBaseProps) => {
    const view = props.props
    const [isListOpen, setIsListOpen] = useState(false)
    const onPick = (id: string, kind: AgentChatTab) => {
        props.on.select(id, kind)
        setIsListOpen(false)
    }
    return (
        <Page chrome="panes" header={{ breadcrumbs: { label: view.crumbLabel, items: [...view.crumbs] } }}>
            <PaneGrid label={view.pageLabel} areas={AREAS} columns={COLUMNS} rows={ROWS}>
                <Pane
                    area="list"
                    surface
                    inset="flush"
                    collapse="drawer"
                    trigger="none"
                    collapseLabel={view.railTitle}
                    closeLabel={view.historyCloseLabel}
                    isOpen={isListOpen}
                    onOpenChange={setIsListOpen}
                >
                    <RailPane {...props} onPick={onPick} />
                </Pane>
                <Pane area="head" surface>
                    <Head {...props} onHistory={() => setIsListOpen(true)} />
                </Pane>
                <Pane area="thread">
                    <PaneSection
                        scroll={{
                            label: view.thread.label,
                            role: "log",
                            tone: "background",
                            align: view.hasConversation ? "end" : "center",
                        }}
                        isLoading={view.isWaiting}
                    >
                        <Thread {...props} />
                    </PaneSection>
                </Pane>
                {view.hasConversation ? (
                    <Pane area="composer" surface>
                        <PaneSection isLoading={view.isWaiting}>
                            <AgentChatComposer
                                {...view.composer}
                                onDraft={props.on.draft}
                                onFile={props.on.file}
                                onFileClear={props.on.fileClear}
                                onPrompt={props.on.send}
                                onSend={props.on.send}
                            />
                        </PaneSection>
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}
