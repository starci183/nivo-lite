import {
    Button,
    Divider,
    Drawer,
    FillViewport,
    Heading,
    IconButton,
    IconTile,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { OfficeComposer } from "@/components/composites/OfficeComposer"
import { OfficeConversations } from "@/components/composites/OfficeConversations"
import { OfficeInfoPanel } from "@/components/composites/OfficeInfoPanel"
import { OfficeTasks } from "@/components/composites/OfficeTasks"
import { OfficeThread } from "@/components/composites/OfficeThread"
import { nivoIconSource } from "@/components/leaves/Icon"
import type {
    OfficeInfoView,
    OfficeListView,
    OfficeTaskView,
    OfficeText,
    OfficeComposerProps,
    OfficeThreadProps,
} from "@/modules/types"
import {
    BODY_CLASS_NAME,
    HEAD_ACTIONS_CLASS_NAME,
    HEAD_AVATAR_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    INFO_COLUMN_CLASS_NAME,
    LIST_BODY_CLASS_NAME,
    LIST_COLUMN_CLASS_NAME,
    LIST_COLUMN_HIDDEN_CLASS_NAME,
    PHONE_ONLY_CLASS_NAME,
    TASKS_CLASS_NAME,
    THREAD_COLUMN_CLASS_NAME,
    THREAD_COLUMN_HIDDEN_CLASS_NAME,
    WIDE_ONLY_CLASS_NAME,
} from "./classNames"

/** What the messenger frame draws: the frame state and the data of each column. */
export interface OfficeMessengerBaseProps {
    readonly props: {
        readonly text: OfficeText
        readonly phoneView: "list" | "thread"
        readonly centre: "chat" | "tasks"
        readonly isLoading: boolean
        readonly isInfoOpen: boolean
        readonly isInfoDocked: boolean
        /** The name of the room shown. */
        readonly title: string
        readonly subtitle: string
        /** The words of the "needs approval" chip, or none when nothing waits. */
        readonly chip: string | null
        readonly list: OfficeListView
        readonly thread: OfficeThreadProps["props"]
        readonly composer: OfficeComposerProps["props"]
        readonly tasks: ReadonlyArray<OfficeTaskView>
        readonly info: OfficeInfoView
    }
    readonly on: OfficeThreadProps["on"] &
        OfficeComposerProps["on"] & {
            readonly back: () => void
            readonly chip: () => void
            readonly toggleInfo: () => void
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
 * info panel on the right (a drawer on narrow screens). It is one top-level card; its columns are joined faces inside it.
 */
export const OfficeMessengerBase = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const isTasks = view.centre === "tasks"
    const infoPanel = <MessengerInfoPanel {...props} />

    return (
        <>
            <FillViewport minHeight="md" bottomInset="none">
                <div className={BODY_CLASS_NAME}>
                    <div className={view.phoneView === "list" ? LIST_COLUMN_CLASS_NAME : LIST_COLUMN_HIDDEN_CLASS_NAME}>
                        <SurfaceCard ariaLabel={text("listLabel")} composition="joined" height="fill">
                            <div className={LIST_BODY_CLASS_NAME}>
                                <OfficeConversations
                                    props={{ list: view.list, isLoading: view.isLoading, text }}
                                    on={{
                                        openGroup: on.openGroup,
                                        openAgent: on.openAgent,
                                        openCustomer: on.openCustomer,
                                    }}
                                />
                            </div>
                        </SurfaceCard>
                    </div>
                    <div
                        className={
                            view.phoneView === "thread" ? THREAD_COLUMN_CLASS_NAME : THREAD_COLUMN_HIDDEN_CLASS_NAME
                        }
                    >
                        <SurfaceCard ariaLabel={text("messengerLabel")} composition="joined" height="fill">
                            <OfficeMessengerHeader {...props} />
                            <Divider semantics="presentation" />
                            {isTasks ? (
                                <div className={TASKS_CLASS_NAME}>
                                    <OfficeTasks props={{ tasks: view.tasks, text }} on={{ openLeads: on.openLeads }} />
                                </div>
                            ) : (
                                <>
                                    <OfficeThread
                                        props={view.thread}
                                        on={{
                                            decideApproval: on.decideApproval,
                                            decideWork: on.decideWork,
                                            decideCard: on.decideCard,
                                            sendCommand: on.sendCommand,
                                            cancelCommand: on.cancelCommand,
                                            reply: on.reply,
                                            loadEarlier: on.loadEarlier,
                                            retry: on.retry,
                                        }}
                                    />
                                    <OfficeComposer props={view.composer} on={{ change: on.change, send: on.send }} />
                                </>
                            )}
                        </SurfaceCard>
                    </div>
                    {view.isInfoDocked && view.isInfoOpen ? (
                        <div className={INFO_COLUMN_CLASS_NAME}>
                            <SurfaceCard ariaLabel={text("infoTitle")} composition="joined" height="fill">
                                {infoPanel}
                            </SurfaceCard>
                        </div>
                    ) : null}
                </div>
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
        </>
    )
}

/** Renders the OfficeMessengerHeader section. */
const OfficeMessengerHeader = (props: OfficeMessengerBaseProps) => {
    const view = props.props
    const on = props.on
    const { text } = view
    const isTasks = view.centre === "tasks"
    return (
        <div className={HEAD_CLASS_NAME}>
            <div className={PHONE_ONLY_CLASS_NAME}>
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("back", "leading")}
                    label={text("back")}
                    onPress={on.back}
                />
            </div>
            <div className={HEAD_AVATAR_CLASS_NAME}>
                <IconTile source={nivoIconSource("community", "leading")} tone="neutral" />
            </div>
            <div className={HEAD_TEXT_CLASS_NAME}>
                <Heading level={1}>{isTasks ? text("tasksTitle") : view.title}</Heading>
                {isTasks ? null : (
                    <Text size="sm" tone="muted" overflow="truncate" isSkeleton={view.isLoading}>
                        {view.subtitle}
                    </Text>
                )}
            </div>
            <div className={HEAD_ACTIONS_CLASS_NAME}>
                {isTasks ? (
                    <div className={WIDE_ONLY_CLASS_NAME}>
                        <Button intent="neutral" size="sm" onPress={on.showChat}>
                            {text("tasksBack")}
                        </Button>
                    </div>
                ) : null}
                {!isTasks && view.chip !== null ? (
                    <Button intent="alternative" size="sm" onPress={on.chip}>
                        {view.chip}
                    </Button>
                ) : null}
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("sidebar", "leading")}
                    label={view.isInfoOpen ? text("infoClose") : text("infoOpen")}
                    isActive={view.isInfoOpen}
                    onPress={on.toggleInfo}
                />
            </div>
        </div>
    )
}

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
