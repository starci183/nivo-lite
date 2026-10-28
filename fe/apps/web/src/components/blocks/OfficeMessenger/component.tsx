import type { ReactNode } from "react"
import { Divider, Drawer, FillViewport, Page, Region, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeHeaderContent } from "@/components/composites/OfficeHeader"
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
 * Office as a messenger: the conversation list on the left, the team thread with its composer pinned at the bottom, and a collapsible
 * info panel on the right (a drawer on narrow screens). The columns are regions of ONE joined Grammar surface.
 */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const infoPanel = <MessengerInfoPanel {...props} />

    const header = OfficeHeaderContent({
        props: {
            text,
            centre: view.centre,
            title: view.title,
            subtitle: view.subtitle,
            chip: view.chip,
            isMuted: view.isMuted,
            isInfoOpen: view.isInfoOpen,
        },
        on: {
            back: on.back,
            chip: on.chip,
            toggleMute: on.toggleMute,
            toggleInfo: on.toggleInfo,
            showChat: on.showChat,
        },
    })

    return (
        <Page measure="full" header={header}>
            <FillViewport minHeight="md" bottomInset="none">
                <SurfaceCard ariaLabel={text("messengerLabel")} composition="joined" height="fill">
                    <div className={BODY_CLASS_NAME}>
                        <Region
                            label={text("listLabel")}
                            className={
                                view.phoneView === "list" ? LIST_COLUMN_CLASS_NAME : LIST_COLUMN_HIDDEN_CLASS_NAME
                            }
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
                        <Region
                            label={text("messengerLabel")}
                            className={
                                view.phoneView === "thread" ? THREAD_COLUMN_CLASS_NAME : THREAD_COLUMN_HIDDEN_CLASS_NAME
                            }
                        >
                            <MessengerCentre {...props} />
                        </Region>
                        {view.isInfoDocked && view.isInfoOpen ? (
                            <InfoColumn label={text("infoTitle")}>{infoPanel}</InfoColumn>
                        ) : null}
                    </div>
                </SurfaceCard>
            </FillViewport>
            {view.isInfoDocked ? null : (
                <Drawer
                    isOpen={view.isInfoOpen}
                    onOpenChange={on.infoOpenChange}
                    placement="right"
                    title={text("infoTitle")}
                    closeLabel={text("infoClose")}
                >
                    {infoPanel}
                </Drawer>
            )}
        </Page>
    )
}

/** The centre column body: the tasks view, or the thread with its composer. */
const MessengerCentre = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const isTasks = view.centre === "tasks"
    return (
        <>
            {isTasks ? (
                <div className={TASKS_CLASS_NAME}>
                    <OfficeTasks props={{ tasks: view.tasks, text }} on={{ openLeads: on.openLeads }} />
                </div>
            ) : (
                <>
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
                    <SlotView slot={view.composerSlot} placeholder={view.composerPlaceholder} labels={view.slotLabels}>
                        {(composer, isSkeleton) => (
                            <OfficeComposer
                                props={{ ...composer, isSkeleton }}
                                on={{ change: on.change, send: on.send }}
                            />
                        )}
                    </SlotView>
                </>
            )}
        </>
    )
}

/** What the docked info column draws. */
type InfoColumnProps = { readonly label: string; readonly children: ReactNode }

/** The docked info column with the hairline that divides it from the thread. */
const InfoColumn = (props: InfoColumnProps) => (
    <>
        <div className={DIVIDER_CLASS_NAME}>
            <Divider orientation="vertical" semantics="presentation" />
        </div>
        <Region label={props.label} className={INFO_COLUMN_CLASS_NAME}>
            {props.children}
        </Region>
    </>
)

/** Connects the shared info panel used by the dock and drawer. */
const MessengerInfoPanel = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    return (
        <OfficeInfoPanel
            props={{ info: view.info, isDocked: view.isInfoDocked, text }}
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
