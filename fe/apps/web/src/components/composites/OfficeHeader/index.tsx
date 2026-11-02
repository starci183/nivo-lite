import { Button, Cluster, Heading, IconButton, IconTile, PaneSection, Text } from "@starci/grammar/common"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import {
    HEAD_ACTIONS_CLASS_NAME,
    HEAD_AVATAR_CLASS_NAME,
    HEAD_BAND_CLASS_NAME,
    HEAD_TITLE_CLASS_NAME,
    PHONE_ONLY_CLASS_NAME,
    WIDE_ONLY_CLASS_NAME,
} from "./classNames"

/** What the Office page head draws and asks. */
interface OfficeHeaderProps {
    readonly props: {
        readonly copy: {
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

/** The head band of the chat column, centred in the shared head row: the room name with its member line, the approval chip and the controls. */
export const OfficeHeader = (props: OfficeHeaderProps) => {
    const view = props.props
    const on = props.on
    const { copy } = view
    const isTasks = view.centre === "tasks"
    return (
        <PaneSection align="center">
            <div className={HEAD_BAND_CLASS_NAME}>
                <Cluster gap="row" wrap={false}>
                    <Cluster gap="row" wrap={false}>
                        <div className={PHONE_ONLY_CLASS_NAME}>
                            <IconButton
                                intent="dismiss"
                                source={nivoIconSource("back", "leading")}
                                label={copy.back}
                                onPress={on.back}
                            />
                        </div>
                        <div className={HEAD_AVATAR_CLASS_NAME}>
                            <IconTile source={nivoIconSource("community", "leading")} tone="neutral" />
                        </div>
                    </Cluster>
                    <div className={HEAD_TITLE_CLASS_NAME}>
                        <Cluster gap="inline" wrap={false}>
                            <Heading level={1}>{isTasks ? copy.tasksTitle : view.title}</Heading>
                            {!isTasks && view.isMuted ? (
                                <Icon props={{ name: "muted", usage: "leading", ariaLabel: copy.mutedChat }} />
                            ) : null}
                        </Cluster>
                        {isTasks ? null : (
                            <Text size="xs" tone="muted">
                                {view.subtitle}
                            </Text>
                        )}
                    </div>
                    <div className={HEAD_ACTIONS_CLASS_NAME}>
                        <Cluster gap="inline" wrap={false}>
                            {isTasks ? (
                                <div className={WIDE_ONLY_CLASS_NAME}>
                                    <Button intent="dismiss" size="sm" onPress={on.showChat}>
                                        {copy.tasksBack}
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
                                label={view.isMuted ? copy.unmuteChat : copy.muteChat}
                                isActive={view.isMuted}
                                onPress={on.toggleMute}
                            />
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("sidebar", "leading")}
                                label={view.isInfoOpen ? copy.infoClose : copy.infoOpen}
                                isActive={view.isInfoOpen}
                                onPress={on.toggleInfo}
                            />
                        </Cluster>
                    </div>
                </Cluster>
            </div>
        </PaneSection>
    )
}
