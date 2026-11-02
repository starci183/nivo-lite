import { PaneSection } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeTasks } from "@/components/composites/OfficeTasks"
import { OfficeMessengerThread } from "@/components/frames/OfficeMessengerThread"
import { OfficeMessengerFrame } from "@/components/frames/OfficeMessengerFrame"
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
export type OfficeMessengerThread = Omit<OfficeThreadProps["props"], "isLoading">

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
        readonly threadSlot: DataSlot<OfficeMessengerThread>
        readonly threadPlaceholder: OfficeMessengerThread
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
            readonly conversationQuery: OfficeConversationsProps["on"]["query"]
            readonly conversationFilter: OfficeConversationsProps["on"]["filter"]
            readonly formatMembersOverflow: OfficeConversationsProps["on"]["formatMembersOverflow"]
            readonly jumpApproval: (id: string) => void
            readonly jumpException: (id: string) => void
            readonly jumpCard: (id: string) => void
            readonly mention: (handle: string) => void
            readonly openTasks: () => void
            readonly closeInfo: () => void
            readonly openLeads: () => void
            readonly taskOwner: OfficeTasksProps["on"]["owner"]
            readonly taskStatus: OfficeTasksProps["on"]["status"]
            readonly clearTasks: OfficeTasksProps["on"]["clear"]
        }
}

/** Keeps each independent read in the block and hands only rendered regions to the messenger frame. */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    return (
        <OfficeMessengerFrame
            arrangement={view.arrangement}
            phoneView={view.phoneView}
            centre={view.centre}
            isCompact={view.isCompact}
            isInfoOpen={view.isInfoOpen}
            isMuted={view.isMuted}
            title={view.title}
            subtitle={view.subtitle}
            chip={view.chip}
            headerCopy={view.headerCopy}
            infoCopy={view.infoCopy}
            info={view.info}
            label={view.labels.messenger}
            listTitle={view.labels.list}
            infoTitle={view.labels.info}
            infoOpenLabel={view.labels.infoOpen}
            infoCloseLabel={view.labels.infoClose}
            list={<MessengerList {...props} />}
            thread={<MessengerCentre {...props} />}
            composer={<MessengerComposer {...props} />}
            onBack={on.back}
            onChip={on.chip}
            onToggleMute={on.toggleMute}
            onToggleInfo={on.toggleInfo}
            onShowChat={on.showChat}
            onInfoOpenChange={on.infoOpenChange}
            onCloseInfo={on.closeInfo}
            onJumpApproval={on.jumpApproval}
            onJumpException={on.jumpException}
            onJumpCard={on.jumpCard}
            onMention={on.mention}
            onOpenTasks={on.openTasks}
        />
    )
}

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
