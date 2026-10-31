import { Page, Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeHeader } from "@/components/composites/OfficeHeader"
import { OfficeInfoHead, OfficeInfoPanel } from "@/components/composites/OfficeInfoPanel"
import { OfficeTasks } from "@/components/composites/OfficeTasks"
import { OfficeThread } from "@/components/composites/OfficeThread"
import { OfficeThreadScroll } from "@/components/composites/OfficeThreadScroll"
import type {
    Arrangement,
    DataSlot,
    OfficeInfoView,
    OfficeListView,
    OfficeTaskView,
    OfficeText,
    OfficeComposerProps,
    OfficeThreadProps,
    SlotLabels,
} from "@/modules/types"

/** What the thread draws once its messages are in. */
export type OfficeMessengerThread = Omit<OfficeThreadProps["props"], "isSkeleton">

/** What the composer draws once the room is in. */
export type OfficeMessengerComposer = Omit<OfficeComposerProps["props"], "isSkeleton">

/** What the messenger frame draws: the frame state and the data of each column. */
export interface OfficeMessengerBaseProps {
    readonly props: {
        readonly text: OfficeText
        readonly phoneView: "list" | "thread"
        readonly centre: "chat" | "tasks"
        readonly isInfoOpen: boolean
        readonly isInfoDocked: boolean
        /** Narrower than the side-by-side breakpoint: the info panel opens as the workspace drawer. */
        readonly isCompact: boolean
        /** The pane areas and tracks for the frame. */
        readonly arrangement: Arrangement
        /** I muted this conversation: the list shows a dot instead of the count. */
        readonly isMuted: boolean
        /** The name of the room shown. */
        readonly title: string
        readonly subtitle: string
        /** The words of the "needs approval" chip, or none when nothing waits. */
        readonly chip: string | null
        /** The list, the thread and the composer are three slots: all wait for the room, only the thread can fail. */
        readonly listSlot: DataSlot<OfficeListView>
        readonly listPlaceholder: OfficeListView
        readonly threadSlot: DataSlot<OfficeMessengerThread>
        readonly threadPlaceholder: OfficeMessengerThread
        readonly composerSlot: DataSlot<OfficeMessengerComposer>
        readonly composerPlaceholder: OfficeMessengerComposer
        readonly slotLabels: SlotLabels
        readonly tasks: ReadonlyArray<OfficeTaskView>
        readonly info: OfficeInfoView
    }
    readonly on: OfficeThreadProps["on"] &
        OfficeComposerProps["on"] & {
            readonly retry: () => void
            readonly back: () => void
            readonly chip: () => void
            readonly toggleInfo: () => void
            readonly toggleMute: () => void
            readonly infoOpenChange: (isOpen: boolean) => void
            readonly showChat: () => void
            readonly openGroup: (id: string) => void
            readonly openAgent: (id: string) => void
            readonly openCustomer: (id: string) => void
            readonly jumpApproval: (id: string) => void
            readonly jumpException: (id: string) => void
            readonly jumpCard: (id: string) => void
            readonly mention: (handle: string) => void
            readonly openTasks: () => void
            readonly closeInfo: () => void
            readonly openLeads: () => void
        }
}

/**
 * Office as a messenger: a panes page whose PaneGrid fills the region to the viewport bottom, with the conversation list,
 * the Office column (head band, thread, composer pinned at the bottom) and the group info column, flush with a divider
 * between. Every band is a PaneSection, so all of them start at the pane inset. Below the compact boundary the grid is one
 * column: the list is its own screen on a phone, and the info column opens as a drawer.
 */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const arrangement = view.arrangement
    const isTasks = view.centre === "tasks"
    const isListScreen = view.isCompact && view.phoneView === "list"
    const hasList = isListScreen || !view.isCompact
    const hasCentre = !isListScreen
    const hasDockedInfo = !view.isCompact && view.isInfoOpen
    const hasDrawerInfo = view.isCompact && !isListScreen

    return (
        <Page chrome="panes">
            <PaneGrid
                label={text("messengerLabel")}
                areas={arrangement.areas}
                columns={arrangement.columns}
                rows={arrangement.rows}
            >
                {hasList ? (
                    <Pane area="listHead" surface>
                        <PaneSection align="center">
                            <Text weight="semibold">{text("listTitle")}</Text>
                        </PaneSection>
                    </Pane>
                ) : null}
                {hasList ? (
                    <Pane area="list" surface>
                        <MessengerList {...props} />
                    </Pane>
                ) : null}
                {hasCentre ? (
                    <Pane area="head" surface>
                        <MessengerHeader {...props} />
                    </Pane>
                ) : null}
                {hasCentre ? (
                    <Pane area="thread">
                        <MessengerCentre {...props} />
                    </Pane>
                ) : null}
                {hasCentre && !isTasks ? (
                    <Pane area="composer" surface>
                        <MessengerComposer {...props} />
                    </Pane>
                ) : null}
                {hasDockedInfo ? (
                    <Pane area="infoHead" surface>
                        <OfficeInfoHead props={{ text }} on={{ close: on.closeInfo }} />
                    </Pane>
                ) : null}
                {hasDockedInfo ? (
                    <Pane area="info" surface scroll label={text("infoTitle")}>
                        <MessengerInfoPanel {...props} />
                    </Pane>
                ) : null}
                {hasDrawerInfo ? (
                    <Pane
                        area="info"
                        surface
                        collapse="drawer"
                        collapseLabel={text("infoTitle")}
                        openLabel={text("infoOpen")}
                        closeLabel={text("infoClose")}
                        isOpen={view.isInfoOpen}
                        onOpenChange={on.infoOpenChange}
                    >
                        <MessengerInfoPanel {...props} />
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}

/** The bands of the list pane: the search, the filter and the conversation list. */
const MessengerList = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return (
        <SlotView slot={view.listSlot} placeholder={view.listPlaceholder} labels={view.slotLabels}>
            {(list, isSkeleton) => (
                <OfficeConversations
                    props={{ list, isSkeleton, text }}
                    on={{ openGroup: on.openGroup, openAgent: on.openAgent, openCustomer: on.openCustomer }}
                />
            )}
        </SlotView>
    )
}

/** The Office header row: the room, its member line and the controls. */
const MessengerHeader = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    return (
        <OfficeHeader
            props={{
                text: view.text,
                centre: view.centre,
                title: view.title,
                subtitle: view.subtitle,
                chip: view.chip,
                isMuted: view.isMuted,
                isInfoOpen: view.isInfoOpen,
            }}
            on={{
                back: on.back,
                chip: on.chip,
                toggleMute: on.toggleMute,
                toggleInfo: on.toggleInfo,
                showChat: on.showChat,
            }}
        />
    )
}

/** The scroll band of the conversation pane: the tasks view, or the thread pinned to the newest. */
const MessengerCentre = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return view.centre === "tasks" ? (
        <PaneSection scroll={{ label: text("tasksTitle") }}>
            <OfficeTasks props={{ tasks: view.tasks, text }} on={{ openLeads: on.openLeads }} />
        </PaneSection>
    ) : (
        <OfficeThreadScroll label={text("conversationLabel")}>
            <SlotView
                slot={view.threadSlot}
                placeholder={view.threadPlaceholder}
                labels={view.slotLabels}
                onRetry={on.retry}
            >
                {(thread, isSkeleton) => (
                    <OfficeThread
                        props={{ ...thread, isSkeleton }}
                        on={{
                            decideApproval: on.decideApproval,
                            decideWork: on.decideWork,
                            decideCard: on.decideCard,
                            sendCommand: on.sendCommand,
                            cancelCommand: on.cancelCommand,
                            reply: on.reply,
                            loadEarlier: on.loadEarlier,
                            editCard: on.editCard,
                            copy: on.copy,
                        }}
                    />
                )}
            </SlotView>
        </OfficeThreadScroll>
    )
}

/** The composer pinned under the thread. */
const MessengerComposer = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    return (
        <SlotView slot={view.composerSlot} placeholder={view.composerPlaceholder} labels={view.slotLabels}>
            {(composer, isSkeleton) => (
                <OfficeComposer props={{ ...composer, isSkeleton }} on={{ change: on.change, send: on.send }} />
            )}
        </SlotView>
    )
}

/** Connects the shared info panel used by the docked column and the drawer. */
const MessengerInfoPanel = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return (
        <OfficeInfoPanel
            props={{ info: view.info, text }}
            on={{
                jumpApproval: on.jumpApproval,
                jumpException: on.jumpException,
                jumpCard: on.jumpCard,
                mention: on.mention,
                openTasks: on.openTasks,
            }}
        />
    )
}
