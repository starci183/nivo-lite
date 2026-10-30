import { PaneLayout, Divider, FillViewport, Page, Region } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeHeader } from "@/components/composites/OfficeHeader"
import { OfficeInfoPanel } from "@/components/composites/OfficeInfoPanel"
import { OfficeTasks } from "@/components/composites/OfficeTasks"
import { OfficeThread } from "@/components/composites/OfficeThread"
import type {
    DataSlot,
    OfficeInfoView,
    OfficeListView,
    OfficeTaskView,
    OfficeText,
    OfficeComposerProps,
    OfficeThreadProps,
    SlotLabels,
} from "@/modules/types"
import {
    BODY_CLASS_NAME,
    CONVERSATION_CLASS_NAME,
    DIVIDER_CLASS_NAME,
    INFO_COLUMN_CLASS_NAME,
    LIST_COLUMN_CLASS_NAME,
    LIST_COLUMN_HIDDEN_CLASS_NAME,
    TASKS_CLASS_NAME,
    THREAD_COLUMN_CLASS_NAME,
    THREAD_COLUMN_HIDDEN_CLASS_NAME,
} from "./classNames"

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

/** The chat workbench: header, conversation, composer and, when the info panel is shown, the rail. */
const MessengerWorkspace = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const infoPanel = <MessengerInfoPanel {...props} isDocked={false} />
    const isTasks = view.centre === "tasks"

    const workspace = {
        label: text("messengerLabel"),
        conversationLabel: text("messengerLabel"),
        header: (
            <OfficeHeader
                props={{
                    text,
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
        ),
        conversation: (
            <div className={CONVERSATION_CLASS_NAME}>
                <MessengerCentre {...props} />
            </div>
        ),
        composer: isTasks ? null : <MessengerComposer {...props} />,
    }
    if (!view.isCompact) return <PaneLayout {...workspace} />
    return (
        <PaneLayout
            {...workspace}
            rail={infoPanel}
            railLabel={text("infoTitle")}
            railOpenLabel={text("infoOpen")}
            railCloseLabel={text("infoClose")}
            isRailOpen={view.isInfoOpen}
            onRailOpenChange={on.infoOpenChange}
        />
    )
}

/**
 * Office as a messenger, full-bleed: the conversation list on the left, then the chat workbench with the team thread, its composer
 * pinned at the bottom and the info rail. The columns are separated by vertical dividers only.
 */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view

    return (
        <Page chrome="bleed">
            <FillViewport minHeight="md" bottomInset="none">
                <div className={BODY_CLASS_NAME}>
                    <Region
                        label={text("listLabel")}
                        className={view.phoneView === "list" ? LIST_COLUMN_CLASS_NAME : LIST_COLUMN_HIDDEN_CLASS_NAME}
                    >
                        <SlotView slot={view.listSlot} placeholder={view.listPlaceholder} labels={view.slotLabels}>
                            {(list, isSkeleton) => (
                                <OfficeConversations
                                    props={{ list, isSkeleton, text }}
                                    on={{
                                        openGroup: on.openGroup,
                                        openAgent: on.openAgent,
                                        openCustomer: on.openCustomer,
                                    }}
                                />
                            )}
                        </SlotView>
                    </Region>
                    <div className={DIVIDER_CLASS_NAME}>
                        <Divider orientation="vertical" semantics="presentation" />
                    </div>
                    <div
                        className={
                            view.phoneView === "thread" ? THREAD_COLUMN_CLASS_NAME : THREAD_COLUMN_HIDDEN_CLASS_NAME
                        }
                    >
                        <MessengerWorkspace {...props} />
                    </div>
                    {view.isInfoOpen && !view.isCompact ? (
                        <>
                            <div className={DIVIDER_CLASS_NAME}>
                                <Divider orientation="vertical" semantics="presentation" />
                            </div>
                            <Region label={text("infoTitle")} className={INFO_COLUMN_CLASS_NAME}>
                                <MessengerInfoPanel {...props} isDocked />
                            </Region>
                        </>
                    ) : null}
                </div>
            </FillViewport>
        </Page>
    )
}

/** The conversation scroll content: the tasks view, or the thread. */
const MessengerCentre = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return view.centre === "tasks" ? (
        <div className={TASKS_CLASS_NAME}>
            <OfficeTasks props={{ tasks: view.tasks, text }} on={{ openLeads: on.openLeads }} />
        </div>
    ) : (
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

/** The messenger props plus whether the panel shows its own header row (the docked column) or not (the drawer). */
type MessengerInfoPanelProps = OfficeMessengerBaseProps & { readonly isDocked: boolean }

/** Connects the shared info panel used by the dock and drawer. */
const MessengerInfoPanel = (props: MessengerInfoPanelProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return (
        <OfficeInfoPanel
            props={{ info: view.info, isDocked: props.isDocked, text }}
            on={{
                jumpApproval: on.jumpApproval,
                jumpException: on.jumpException,
                jumpCard: on.jumpCard,
                mention: on.mention,
                openTasks: on.openTasks,
                close: on.closeInfo,
            }}
        />
    )
}
