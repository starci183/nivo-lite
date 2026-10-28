import { Button, IconButton, IconTile, type PageHeaderContent } from "@starci/grammar/common"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeText } from "@/modules/types"
import {
    HEAD_ACTIONS_CLASS_NAME,
    HEAD_AVATAR_CLASS_NAME,
    MARK_CLASS_NAME,
    PHONE_ONLY_CLASS_NAME,
    WIDE_ONLY_CLASS_NAME,
} from "./classNames"

/** What the Office page head draws and asks. */
interface OfficeHeaderContentProps {
    readonly props: {
        readonly text: OfficeText
        readonly centre: "chat" | "tasks"
        readonly title: string
        readonly subtitle: string
        /** The words of the "needs approval" chip, or none when nothing waits. */
        readonly chip: string | null
        readonly isMuted: boolean
        readonly isInfoOpen: boolean
    }
    readonly on: {
        readonly back: () => void
        readonly chip: () => void
        readonly toggleMute: () => void
        readonly toggleInfo: () => void
        readonly showChat: () => void
    }
}

/** The Office page head as Page header content: the room name, its member line, the approval chip and the controls. */
export const OfficeHeaderContent = (props: OfficeHeaderContentProps): PageHeaderContent => {
    const view = props.props
    const on = props.on
    const { text } = view
    const isTasks = view.centre === "tasks"
    return {
        title: isTasks ? text("tasksTitle") : view.title,
        mark: (
            <div className={MARK_CLASS_NAME}>
                <div className={PHONE_ONLY_CLASS_NAME}>
                    <IconButton
                        intent="dismiss"
                        source={nivoIconSource("back", "leading")}
                        label={text("back")}
                        onPress={on.back}
                    />
                </div>
                <div className={HEAD_AVATAR_CLASS_NAME}>
                    <IconTile source={nivoIconSource("community", "leading")} tone="neutral" />
                </div>
            </div>
        ),
        status:
            !isTasks && view.isMuted ? (
                <Icon props={{ name: "muted", usage: "leading", ariaLabel: text("mutedChat") }} />
            ) : undefined,
        description: isTasks ? undefined : view.subtitle,
        actions: (
            <div className={HEAD_ACTIONS_CLASS_NAME}>
                {isTasks ? (
                    <div className={WIDE_ONLY_CLASS_NAME}>
                        <Button intent="dismiss" size="sm" onPress={on.showChat}>
                            {text("tasksBack")}
                        </Button>
                    </div>
                ) : null}
                {!isTasks && view.chip !== null ? (
                    <Button intent="neutral" size="sm" onPress={on.chip}>
                        {view.chip}
                    </Button>
                ) : null}
                <IconButton
                    intent="neutral"
                    source={nivoIconSource(view.isMuted ? "muted" : "unmuted", "leading")}
                    label={view.isMuted ? text("unmuteChat") : text("muteChat")}
                    isActive={view.isMuted}
                    onPress={on.toggleMute}
                />
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("sidebar", "leading")}
                    label={view.isInfoOpen ? text("infoClose") : text("infoOpen")}
                    isActive={view.isInfoOpen}
                    onPress={on.toggleInfo}
                />
            </div>
        ),
    }
}
