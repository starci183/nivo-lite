import { IconButton, IconTile } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ChatParty } from "@/modules/types"

/** The words of the head of a room. */
interface TeamChatRoomHeadCopy {
    readonly title: string
    readonly back: string
    /** The head line of a group: its members, composed of the count and this word. */
    readonly members: string
    readonly mute: string
    readonly unmute: string
}

/** What the head of a room draws and what it asks of its owner. */
interface TeamChatRoomHeadProps {
    readonly copy: TeamChatRoomHeadCopy
    /** The open room, or null when none is. */
    readonly roomId: string | null
    readonly title: string
    /** Who a direct room is with; null for a group or none open. */
    readonly other: ChatParty | null
    readonly memberCount: number
    readonly isWaiting: boolean
    /** The head has a way back to the list of rooms (the chat page; the agent tab has none). */
    readonly canGoBack: boolean
    /** The viewer muted the room; null when no room is open. */
    readonly isMuted: boolean | null
    readonly onBack: () => void
    readonly onToggleMute: () => void
}

/** The mark of the room the head names: the agent's, the person's, or the group's chat glyph; none while no room is open. */
const markOf = (roomId: string | null, title: string, other: ChatParty | null) => {
    if (roomId === null) return undefined
    if (other === null) return <IconTile source={nivoIconSource("chat", "leading")} tone="neutral" />
    if (other.kind === "agent") return <AgentMark label={title} seed={other.id} size="control" />
    return <PersonAvatar name={title} seed={other.id} size="md" />
}

/** The head of the open room: who it is with, how many it holds, the mute of it, and the link to the full page in the panel. */
export const TeamChatRoomHead = (props: TeamChatRoomHeadProps) => {
    const mark = markOf(props.roomId, props.title, props.other)
    const isGroup = props.roomId !== null && props.other === null
    return (
        <PaneHead
            title={props.roomId === null ? props.copy.title : props.title}
            headingLevel={props.canGoBack ? 1 : 2}
            {...(isGroup ? { description: `${props.memberCount} ${props.copy.members}` } : {})}
            {...(mark === undefined ? {} : { mark })}
            {...(props.canGoBack ? { back: { label: props.copy.back, onPress: props.onBack } } : {})}
            isLoading={props.isWaiting}
            actions={
                <>
                    {props.isMuted === null ? null : (
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource(props.isMuted ? "muted" : "unmuted", "leading")}
                            label={props.isMuted ? props.copy.unmute : props.copy.mute}
                            onPress={props.onToggleMute}
                        />
                    )}
                </>
            }
        />
    )
}
