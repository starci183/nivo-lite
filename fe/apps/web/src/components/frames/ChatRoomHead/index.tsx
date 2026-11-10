import type { ReactNode } from "react"
import { PaneHead } from "@/components/composites/PaneHead"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import type { TeamChatHeadView } from "@/modules/types"

/** What the head of a chat pane draws: who it is with, the way back when there is one, and the tools at the end (its children). */
interface ChatRoomHeadProps {
    readonly head: TeamChatHeadView
    readonly isWaiting: boolean
    /** The way back to the list of rooms (the chat page on a phone); absent when the pane has none. */
    readonly back?: { readonly label: string; readonly onPress: () => void }
    /** The tools at the end of the head (pinned, members, mute); none when the pane has none. */
    readonly children?: ReactNode
}

/**
 * The head band of every chat pane of the app, on the surface with the separator under it: the mark of who the conversation is
 * with, its name and, muted under it, what it holds. The team chat room and the setup chat with NIVO both draw it.
 */
export const ChatRoomHead = (props: ChatRoomHeadProps) => (
    <PaneHead
        title={props.head.title}
        headingLevel={props.back === undefined ? 2 : 1}
        {...(props.head.subtitle === "" ? {} : { description: props.head.subtitle })}
        mark={<ChatPartyMark mark={props.head.mark} />}
        {...(props.back === undefined ? {} : { back: props.back })}
        {...(props.children === undefined ? {} : { actions: props.children })}
        isLoading={props.isWaiting}
    />
)
