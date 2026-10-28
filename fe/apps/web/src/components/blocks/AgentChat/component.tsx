import { useState } from "react"
import { Divider, FillViewport, Page, Region, SurfaceCard, Tabs, type BreadcrumbItem } from "@starci/grammar/common"

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
import {
    CHANNEL_BAR_CLASS_NAME,
    FRAME_CLASS_NAME,
    LIST_COLUMN_CLASS_NAME,
    LIST_COLUMN_OPEN_CLASS_NAME,
    LIST_SCROLL_CLASS_NAME,
    MAIN_CLASS_NAME,
} from "./classNames"

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
    readonly newLabel: string
    readonly isStarting: boolean
    readonly railSlot: DataSlot<ReadonlyArray<AgentChatRailRow>>
    readonly railLabels: SlotLabels
    readonly header: Omit<
        AgentChatHeaderProps,
        "glyph" | "module" | "onBack" | "onTakeover" | "onOpenLead" | "onToggleList"
    >
    readonly channelTabs: ChannelTabsView | null
    readonly threadSlot: DataSlot<ThreadView>
    readonly threadLabels: SlotLabels
    readonly thread: Omit<AgentChatThreadProps, "children">
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

/** The base props of the chat and the way a picked row is handled. */
interface RailProps extends AgentChatBaseProps {
    readonly onPick: (id: string, kind: AgentChatTab) => void
}

/** The conversation rail: its head and its rows, wherever it is drawn. */
const Rail = (props: RailProps) => (
    <>
        <AgentChatRailHead
            title={props.props.railTitle}
            newLabel={props.props.newLabel}
            isDisabled={props.props.isStartDisabled}
            isStarting={props.props.isStarting}
            onStart={props.on.start}
        />
        <div className={LIST_SCROLL_CLASS_NAME}>
            <SlotView slot={props.props.railSlot} placeholder={NO_ROWS} labels={props.props.railLabels}>
                {(rows, isSkeleton) => (
                    <AgentChatRailList
                        label={props.props.railTitle}
                        rows={rows}
                        glyph={props.props.glyph}
                        module={props.props.module}
                        isSkeleton={isSkeleton}
                        onPick={props.onPick}
                    />
                )}
            </SlotView>
        </div>
    </>
)

/** The open conversation: its messages, or the greeting when none is open. */
const Thread = (props: AgentChatBaseProps) => (
    <AgentChatThread {...props.props.thread}>
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

/** Presentational agent chat, Zalo style: history list, then a thread that fills the page with the composer pinned at the bottom. */
export const AgentChatBase = (props: AgentChatBaseProps) => {
    const view = props.props
    const [isListOpen, setIsListOpen] = useState(false)
    const onPick = (id: string, kind: AgentChatTab) => {
        props.on.select(id, kind)
        setIsListOpen(false)
    }
    return (
        <Page chrome="bleed" header={{ breadcrumbs: { label: view.crumbLabel, items: [...view.crumbs] } }}>
            <FillViewport minHeight="md" bottomInset="page">
                {/* FillViewport owns the page height below the chrome; SURFACE-2 / BOUNDARY-6: the chat is one top-level card, its
          columns are joined faces inside it. */}
                <SurfaceCard ariaLabel={view.pageLabel} composition="joined" height="fill">
                    <div className={FRAME_CLASS_NAME}>
                        <aside className={LIST_COLUMN_CLASS_NAME} aria-label={view.railTitle}>
                            <Rail {...props} onPick={onPick} />
                        </aside>
                        {isListOpen ? (
                            <aside className={LIST_COLUMN_OPEN_CLASS_NAME} aria-label={view.railTitle}>
                                <Rail {...props} onPick={onPick} />
                            </aside>
                        ) : null}
                        <Region
                            className={MAIN_CLASS_NAME}
                            data-list={isListOpen ? "open" : "closed"}
                            label={view.pageLabel}
                        >
                            <AgentChatHeader
                                {...view.header}
                                glyph={view.glyph}
                                module={view.module}
                                onBack={props.on.back}
                                onTakeover={props.on.toggleTakeover}
                                onOpenLead={props.on.openLead}
                                onToggleList={() => setIsListOpen((open) => !open)}
                            />
                            {view.channelTabs === null ? null : (
                                <>
                                    <div className={CHANNEL_BAR_CLASS_NAME}>
                                        <Tabs
                                            variant="secondary"
                                            label={view.channelTabs.label}
                                            selectedKey={view.channelTabs.selectedKey}
                                            items={[...view.channelTabs.items]}
                                            onSelect={(key) => props.on.tab(key === "customer" ? "customer" : "test")}
                                            inset="none"
                                            labelVisibility="always"
                                        />
                                    </div>
                                    <Divider semantics="presentation" />
                                </>
                            )}
                            <Thread {...props} />
                            <AgentChatComposer
                                {...view.composer}
                                onDraft={props.on.draft}
                                onPrompt={props.on.send}
                                onSend={props.on.send}
                            />
                        </Region>
                    </div>
                </SurfaceCard>
            </FillViewport>
        </Page>
    )
}
