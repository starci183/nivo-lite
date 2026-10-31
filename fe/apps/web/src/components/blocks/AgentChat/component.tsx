import { useState } from "react"
import { Page, Pane, PaneGrid, PaneSection, Tabs, type BreadcrumbItem } from "@starci/grammar/common"

import { AgentChatComposer, type AgentChatComposerProps } from "@/components/composites/AgentChatComposer"

import { AgentChatEmpty, type AgentChatEmptyProps } from "@/components/composites/AgentChatEmpty"

import { AgentChatHeader, type AgentChatHeaderProps } from "@/components/composites/AgentChatHeader"

import { AgentChatMessages, type AgentChatMessagesProps } from "@/components/composites/AgentChatMessages"

import { AgentChatRailHead } from "@/components/composites/AgentChatRailHead"
import { AgentChatRailList, type AgentChatRailRow } from "@/components/composites/AgentChatRailList"

import { AgentChatThread, type AgentChatThreadProps } from "@/components/composites/AgentChatThread"

import { PromoWelcomeBand, type PromoWelcomeBandProps } from "@/components/composites/PromoWelcomeBand"

import { SlotView } from "@/components/composites/SlotView"
import type { ModuleIconName, DataSlot, SlotLabels } from "@/modules/types"

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
    readonly glyph: ModuleIconName
    readonly module: string
    readonly railTitle: string
    /** The trigger that opens the conversation rail where it is a drawer, and the control that closes it. */
    readonly historyLabel: string
    readonly historyCloseLabel: string
    readonly newLabel: string
    readonly isStarting: boolean
    readonly railSlot: DataSlot<ReadonlyArray<AgentChatRailRow>>
    readonly railLabels: SlotLabels
    readonly header: Omit<AgentChatHeaderProps, "glyph" | "module" | "onBack" | "onTakeover" | "onOpenLead">
    readonly channelTabs: ChannelTabsView | null
    readonly threadSlot: DataSlot<ThreadView>
    readonly threadLabels: SlotLabels
    readonly thread: Omit<AgentChatThreadProps, "children"> & { readonly label: string }
    readonly welcome: Omit<PromoWelcomeBandProps, "onClose"> | null
    readonly messages: Omit<AgentChatMessagesProps, "glyph" | "module" | "isSkeleton">
    readonly empty: Omit<AgentChatEmptyProps, "glyph" | "module" | "onVisitorName" | "onPrompt" | "onStart">
    readonly composer: Omit<AgentChatComposerProps, "onDraft" | "onPrompt" | "onSend">
}

/** What the surface asks of its owner. */
export interface AgentChatHandlers {
    readonly toggleTakeover: () => void
    readonly back: () => void
    readonly tab: (tab: AgentChatTab) => void
    readonly draft: (value: string) => void
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
    >
        {props.props.welcome === null ? null : (
            <PromoWelcomeBand {...props.props.welcome} onClose={props.on.closeWelcome} />
        )}
        <SlotView slot={props.props.threadSlot} placeholder={SKELETON_THREAD} labels={props.props.threadLabels}>
            {(view, isSkeleton) =>
                view.hasSelection ? (
                    <AgentChatMessages
                        {...props.props.messages}
                        glyph={props.props.glyph}
                        module={props.props.module}
                        isSkeleton={isSkeleton}
                    />
                ) : (
                    <AgentChatEmpty
                        {...props.props.empty}
                        glyph={props.props.glyph}
                        module={props.props.module}
                        onVisitorName={props.on.visitorName}
                        onPrompt={props.on.send}
                        onStart={props.on.start}
                    />
                )
            }
        </SlotView>
    </AgentChatThread>
)

/** The header of the open conversation. */
const Head = (props: AgentChatBaseProps) => (
    <AgentChatHeader
        {...props.props.header}
        glyph={props.props.glyph}
        module={props.props.module}
        onBack={props.on.back}
        onTakeover={props.on.toggleTakeover}
        onOpenLead={props.on.openLead}
    />
)

/** The tabs and what picking one does. */
interface ChannelTabsProps {
    readonly tabs: ChannelTabsView
    readonly onTab: (tab: AgentChatTab) => void
}

/** The channel tabs under the header; none when the agent has no customer channel. */
const ChannelTabs = (props: ChannelTabsProps) => (
    <Tabs
        label={props.tabs.label}
        selectedKey={props.tabs.selectedKey}
        items={[...props.tabs.items]}
        onSelect={(key) => props.onTab(key === "customer" ? "customer" : "test")}
        inset="none"
        labelVisibility="always"
    />
)

/** The rail the list draws and what picking a row does. */
interface RailListProps {
    readonly view: AgentChatViewProps
    readonly onPick: (id: string, kind: AgentChatTab) => void
}

/** The conversations of the rail with the pick that also closes the drawer. */
const RailList = (props: RailListProps) => (
    <SlotView slot={props.view.railSlot} placeholder={NO_ROWS} labels={props.view.railLabels}>
        {(rows, isSkeleton) => (
            <AgentChatRailList
                label={props.view.railTitle}
                rows={rows}
                glyph={props.view.glyph}
                module={props.view.module}
                isSkeleton={isSkeleton}
                onPick={props.onPick}
            />
        )}
    </SlotView>
)

/**
 * Presentational agent chat, Zalo style, as panes under the breadcrumb trail: the conversation rail on the surface at the
 * left (a drawer on a phone), and beside it the header, the channel tabs, the thread and the composer pinned under it.
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
            <PaneGrid
                label={view.pageLabel}
                areas={{ base: ["main"], medium: ["list main"] }}
                columns={{ base: ["fill"], medium: ["standard", "fill"] }}
            >
                <Pane
                    area="list"
                    surface
                    collapse="drawer"
                    collapseLabel={view.railTitle}
                    openLabel={view.historyLabel}
                    closeLabel={view.historyCloseLabel}
                    isOpen={isListOpen}
                    onOpenChange={setIsListOpen}
                >
                    <PaneSection align="center">
                        <AgentChatRailHead
                            title={view.railTitle}
                            newLabel={view.newLabel}
                            isDisabled={view.isStartDisabled}
                            isStarting={view.isStarting}
                            onStart={props.on.start}
                        />
                    </PaneSection>
                    <PaneSection scroll={{ label: view.railTitle }}>
                        <RailList view={view} onPick={onPick} />
                    </PaneSection>
                </Pane>
                <Pane area="main">
                    <PaneSection align="center">
                        <Head {...props} />
                    </PaneSection>
                    {view.channelTabs === null ? null : (
                        <PaneSection bleed="inline">
                            <ChannelTabs tabs={view.channelTabs} onTab={props.on.tab} />
                        </PaneSection>
                    )}
                    <PaneSection scroll={{ label: view.thread.label, role: "log", tone: "background" }}>
                        <Thread {...props} />
                    </PaneSection>
                    <PaneSection>
                        <AgentChatComposer
                            {...view.composer}
                            onDraft={props.on.draft}
                            onPrompt={props.on.send}
                            onSend={props.on.send}
                        />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        </Page>
    )
}
