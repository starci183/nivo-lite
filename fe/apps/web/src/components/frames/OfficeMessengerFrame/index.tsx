import type { ReactNode } from "react"
import { Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import { OfficeHeader } from "@/components/composites/OfficeHeader"
import { OfficeInfoHead, OfficeInfoPanel } from "@/components/composites/OfficeInfoPanel"
import type { Arrangement, OfficeInfoPanelProps, OfficeInfoView } from "@/modules/types"

/** The messenger's regions and resolved chrome; independent data slots stay in the block. */
interface OfficeMessengerFrameProps {
    readonly arrangement: Arrangement
    readonly phoneView: "list" | "thread"
    readonly centre: "chat" | "tasks"
    readonly isCompact: boolean
    readonly isInfoOpen: boolean
    readonly isMuted: boolean
    readonly title: string
    readonly subtitle: string
    readonly chip: string | null
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
    readonly info: OfficeInfoView
    readonly label: string
    readonly listTitle: string
    readonly infoTitle: string
    readonly infoOpenLabel: string
    readonly infoCloseLabel: string
    readonly list: ReactNode
    readonly thread: ReactNode
    readonly composer: ReactNode
    readonly onBack: () => void
    readonly onChip: () => void
    readonly onToggleMute: () => void
    readonly onToggleInfo: () => void
    readonly onShowChat: () => void
    readonly onInfoOpenChange: (isOpen: boolean) => void
    readonly onCloseInfo: () => void
    readonly onJumpApproval: OfficeInfoPanelProps["on"]["jumpApproval"]
    readonly onJumpException: OfficeInfoPanelProps["on"]["jumpException"]
    readonly onJumpCard: OfficeInfoPanelProps["on"]["jumpCard"]
    readonly onMention: OfficeInfoPanelProps["on"]["mention"]
    readonly onOpenTasks: OfficeInfoPanelProps["on"]["openTasks"]
}

interface MessengerFrameHeaderProps {
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
    readonly centre: "chat" | "tasks"
    readonly title: string
    readonly subtitle: string
    readonly chip: string | null
    readonly isMuted: boolean
    readonly isInfoOpen: boolean
    readonly onBack: () => void
    readonly onChip: () => void
    readonly onToggleMute: () => void
    readonly onToggleInfo: () => void
    readonly onShowChat: () => void
}

interface MessengerFrameInfoProps {
    readonly info: OfficeInfoView
    readonly infoCopy: OfficeInfoPanelProps["props"]["copy"]
    readonly onJumpApproval: OfficeInfoPanelProps["on"]["jumpApproval"]
    readonly onJumpException: OfficeInfoPanelProps["on"]["jumpException"]
    readonly onJumpCard: OfficeInfoPanelProps["on"]["jumpCard"]
    readonly onMention: OfficeInfoPanelProps["on"]["mention"]
    readonly onOpenTasks: OfficeInfoPanelProps["on"]["openTasks"]
}

/** Preserves the messenger's flush pane bands and its docked-or-drawer information column. */
export const OfficeMessengerFrame = (props: OfficeMessengerFrameProps) => {
    const isListScreen = props.isCompact && props.phoneView === "list"
    const hasList = isListScreen || !props.isCompact
    const hasCentre = !isListScreen
    const hasDockedInfo = !props.isCompact && props.isInfoOpen
    const hasDrawerInfo = props.isCompact && !isListScreen
    const infoPanel = <MessengerFrameInfo {...props} />
    return (
        <PaneGrid
            label={props.label}
            areas={props.arrangement.areas}
            columns={props.arrangement.columns}
            rows={props.arrangement.rows}
        >
            {hasList ? (
                <Pane area="listHead" surface>
                    <PaneSection align="center">
                        <Text isStrong>{props.listTitle}</Text>
                    </PaneSection>
                </Pane>
            ) : null}
            {hasList ? (
                <Pane area="list" surface>
                    {props.list}
                </Pane>
            ) : null}
            {hasCentre ? (
                <Pane area="head" surface>
                    <MessengerFrameHeader {...props} />
                </Pane>
            ) : null}
            {hasCentre ? <Pane area="thread">{props.thread}</Pane> : null}
            {hasCentre && props.centre !== "tasks" ? (
                <Pane area="composer" surface>
                    {props.composer}
                </Pane>
            ) : null}
            {hasDockedInfo ? (
                <Pane area="infoHead" surface>
                    <OfficeInfoHead
                        props={{ title: props.infoTitle, closeLabel: props.infoCloseLabel }}
                        on={{ close: props.onCloseInfo }}
                    />
                </Pane>
            ) : null}
            {hasDockedInfo ? (
                <Pane area="info" surface scroll label={props.infoTitle}>
                    {infoPanel}
                </Pane>
            ) : null}
            {hasDrawerInfo ? (
                <Pane
                    area="info"
                    surface
                    collapse="drawer"
                    collapseLabel={props.infoTitle}
                    openLabel={props.infoOpenLabel}
                    closeLabel={props.infoCloseLabel}
                    isOpen={props.isInfoOpen}
                    onOpenChange={props.onInfoOpenChange}
                >
                    {infoPanel}
                </Pane>
            ) : null}
        </PaneGrid>
    )
}

/** The existing header owns its same chrome and receives only its original resolved data/actions. */
const MessengerFrameHeader = (props: MessengerFrameHeaderProps) => (
    <OfficeHeader
        props={{
            copy: props.headerCopy,
            centre: props.centre,
            title: props.title,
            subtitle: props.subtitle,
            chip: props.chip,
            isMuted: props.isMuted,
            isInfoOpen: props.isInfoOpen,
        }}
        on={{
            back: props.onBack,
            chip: props.onChip,
            toggleMute: props.onToggleMute,
            toggleInfo: props.onToggleInfo,
            showChat: props.onShowChat,
        }}
    />
)

/** Docked and drawer placements use the same information body and jump commands. */
const MessengerFrameInfo = (props: MessengerFrameInfoProps) => (
    <OfficeInfoPanel
        props={{ info: props.info, copy: props.infoCopy }}
        on={{
            jumpApproval: props.onJumpApproval,
            jumpException: props.onJumpException,
            jumpCard: props.onJumpCard,
            mention: props.onMention,
            openTasks: props.onOpenTasks,
        }}
    />
)
