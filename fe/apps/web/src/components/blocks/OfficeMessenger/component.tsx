import { Page, Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeHeader } from "@/components/composites/OfficeHeader"
import { OfficeInfoHead, OfficeInfoPanel } from "@/components/composites/OfficeInfoPanel"
import { OfficeTasks } from "@/components/composites/OfficeTasks"
import { OfficeMessengerThread } from "@/components/frames/OfficeMessengerThread"
import { OfficeThreadScroll } from "@/components/frames/OfficeThreadScroll"
import type {
    Arrangement,
    DataSlot,
    OfficeInfoView,
    OfficeInfoPanelProps,
    OfficeConversationsProps,
    OfficeTasksProps,
    OfficeComposerProps,
    OfficeThreadProps,
    SlotLabels,
} from "@/modules/types"

/** What the thread draws once its messages are in. */
export type OfficeMessengerThreadData = Omit<OfficeThreadProps["props"], "isLoading">

/** What the composer draws once the room is in. */
export type OfficeMessengerComposer = Omit<OfficeComposerProps["props"], "isLoading">

/** What the messenger frame draws: the frame state and the data of each column. */
export interface OfficeMessengerBaseProps {
    readonly props: {
        readonly headerCopy: {
            readonly back: string
            readonly tasksTitle: string
            readonly mutedChat: string
            readonly tasksBack: string
            readonly unmuteChat: string
            readonly muteChat: string
            readonly infoClose: string
            readonly infoOpen: string
        }
        readonly infoCopy: OfficeInfoPanelProps["props"]["copy"]
        readonly labels: {
            readonly messenger: string
            readonly list: string
            readonly info: string
            readonly infoOpen: string
            readonly infoClose: string
            readonly tasks: string
            readonly conversation: string
            readonly nivoCore: string
            readonly aiBadge: string
        }
        readonly phoneView: "list" | "thread"
        readonly centre: "chat" | "tasks"
        readonly isInfoOpen: boolean
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
        readonly listSlot: DataSlot<Omit<OfficeConversationsProps["props"], "isLoading">>
        readonly listPlaceholder: Omit<OfficeConversationsProps["props"], "isLoading" | "text">
        readonly threadSlot: DataSlot<OfficeMessengerThreadData>
        readonly threadPlaceholder: OfficeMessengerThreadData
        readonly composerSlot: DataSlot<OfficeMessengerComposer>
        readonly composerPlaceholder: OfficeMessengerComposer
        readonly slotLabels: SlotLabels
        readonly tasks: OfficeTasksProps["props"]
        readonly info: OfficeInfoView
    }
    readonly on: OfficeThreadProps["on"] &
        OfficeComposerProps["on"] & {
            readonly retryList: () => void
            readonly retryThread: () => void
            readonly retryComposer: () => void
            readonly back: () => void
            readonly chip: () => void
            readonly toggleInfo: () => void
            readonly toggleMute: () => void
            readonly infoOpenChange: (isOpen: boolean) => void
            readonly showChat: () => void
            readonly openGroup: (id: string) => void
            readonly openAgent: (id: string) => void
            readonly openCustomer: (id: string) => void
            readonly conversationQuery: (value: string) => void
            readonly conversationFilter: (value: string) => void
            readonly formatMembersOverflow: (count: number) => string
            readonly jumpApproval: (id: string) => void
            readonly jumpException: (id: string) => void
            readonly jumpCard: (id: string) => void
            readonly mention: (handle: string) => void
            readonly openTasks: () => void
            readonly closeInfo: () => void
            readonly openLeads: () => void
            readonly taskOwner: (value: string) => void
            readonly taskStatus: (value: string) => void
            readonly clearTasks: () => void
        }
}

/**
 * Keeps each independent read in the block and draws the messenger as `Page chrome="panes"` over one `PaneGrid`: the list,
 * the header, the thread, the composer and the docked-or-drawer information column are its flush pane bands.
 */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const isListScreen = view.isCompact && view.phoneView === "list"
    const hasList = isListScreen || !view.isCompact
    const hasCentre = !isListScreen
    const hasDockedInfo = !view.isCompact && view.isInfoOpen
    const hasDrawerInfo = view.isCompact && !isListScreen
    return (
        <Page chrome="panes">
            <PaneGrid
                label={view.labels.messenger}
                areas={view.arrangement.areas}
                columns={view.arrangement.columns}
                rows={view.arrangement.rows}
            >
                {hasList ? (
                    <Pane area="listHead" surface>
                        <PaneSection align="center">
                            <Text isStrong>{view.labels.list}</Text>
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
                {hasCentre && view.centre !== "tasks" ? (
                    <Pane area="composer" surface>
                        <MessengerComposer {...props} />
                    </Pane>
                ) : null}
                {hasDockedInfo ? (
                    <Pane area="infoHead" surface>
                        <OfficeInfoHead
                            props={{ title: view.labels.info, closeLabel: view.labels.infoClose }}
                            on={{ close: props.on.closeInfo }}
                        />
                    </Pane>
                ) : null}
                {hasDockedInfo ? (
                    <Pane area="info" surface scroll label={view.labels.info}>
                        <MessengerInfo {...props} />
                    </Pane>
                ) : null}
                {hasDrawerInfo ? (
                    <Pane
                        area="info"
                        surface
                        collapse="drawer"
                        collapseLabel={view.labels.info}
                        openLabel={view.labels.infoOpen}
                        closeLabel={view.labels.infoClose}
                        isOpen={view.isInfoOpen}
                        onOpenChange={props.on.infoOpenChange}
                    >
                        <MessengerInfo {...props} />
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}

/** The existing header owns its same chrome and receives only its original resolved data/actions. */
const MessengerHeader = (props: OfficeMessengerBaseProps) => (
    <OfficeHeader
        props={{
            copy: props.props.headerCopy,
            centre: props.props.centre,
            title: props.props.title,
            subtitle: props.props.subtitle,
            chip: props.props.chip,
            isMuted: props.props.isMuted,
            isInfoOpen: props.props.isInfoOpen,
        }}
        on={{
            back: props.on.back,
            chip: props.on.chip,
            toggleMute: props.on.toggleMute,
            toggleInfo: props.on.toggleInfo,
            showChat: props.on.showChat,
        }}
    />
)

/** Docked and drawer placements use the same information body and jump commands. */
const MessengerInfo = (props: OfficeMessengerBaseProps) => (
    <OfficeInfoPanel
        props={{ info: props.props.info, copy: props.props.infoCopy }}
        on={{
            jumpApproval: props.on.jumpApproval,
            jumpException: props.on.jumpException,
            jumpCard: props.on.jumpCard,
            mention: props.on.mention,
            openTasks: props.on.openTasks,
        }}
    />
)

/** The list waits independently of the conversation and composer. */
const MessengerList = (props: OfficeMessengerBaseProps) => (
    <SlotView
        slot={props.props.listSlot}
        placeholder={props.props.listPlaceholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retryList}
        render={(list, isLoading) => (
            <OfficeConversations
                props={{ ...list, isLoading }}
                on={{
                    openGroup: props.on.openGroup,
                    openAgent: props.on.openAgent,
                    openCustomer: props.on.openCustomer,
                    query: props.on.conversationQuery,
                    filter: props.on.conversationFilter,
                    formatMembersOverflow: props.on.formatMembersOverflow,
                }}
            />
        )}
    />
)

/** The conversation keeps its own scroll owner; switching to tasks keeps the original task scroll band. */
const MessengerCentre = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    return view.centre === "tasks" ? (
        <PaneSection scroll={{ label: view.labels.tasks }}>
            <OfficeTasks
                props={view.tasks}
                on={{
                    openLeads: props.on.openLeads,
                    owner: props.on.taskOwner,
                    status: props.on.taskStatus,
                    clear: props.on.clearTasks,
                }}
            />
        </PaneSection>
    ) : (
        <OfficeThreadScroll label={view.labels.conversation}>
            <SlotView
                slot={view.threadSlot}
                placeholder={view.threadPlaceholder}
                labels={view.slotLabels}
                onRetry={props.on.retryThread}
                render={(thread, isLoading) => (
                    <OfficeMessengerThread thread={thread} isLoading={isLoading} labels={view.labels} on={props.on} />
                )}
            />
        </OfficeThreadScroll>
    )
}

/** The composer is pinned below the thread and keeps its independent read/retry. */
const MessengerComposer = (props: OfficeMessengerBaseProps) => (
    <SlotView
        slot={props.props.composerSlot}
        placeholder={props.props.composerPlaceholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retryComposer}
        render={(composer, isLoading) => (
            <OfficeComposer
                props={{ ...composer, isLoading }}
                on={{
                    change: props.on.change,
                    send: props.on.send,
                    chooseFile: props.on.chooseFile,
                    clearFile: props.on.clearFile,
                }}
            />
        )}
    />
)
