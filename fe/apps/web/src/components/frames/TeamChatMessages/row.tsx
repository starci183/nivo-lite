import { ChatSystemLine } from "@/components/composites/ChatSystemLine"
import { TeamChatAgentCard } from "@/components/composites/TeamChatAgentCard"
import { TeamChatBackgroundStoppedCard } from "@/components/composites/TeamChatBackgroundStoppedCard"
import { TeamChatBrainChangeCard } from "@/components/composites/TeamChatBrainChangeCard"
import { TeamChatBubble } from "@/components/composites/TeamChatBubble"
import { TeamChatStopCard } from "@/components/composites/TeamChatStopCard"
import type {
    TeamChatBrainChangeHandlers,
    TeamChatMessageRow,
    TeamChatMessagesCopy,
    TeamChatStopHandlers,
} from "@/modules/types"

/** One message of the thread and what a person may do with it. */
export interface MessageRowProps {
    readonly row: TeamChatMessageRow
    readonly copy: TeamChatMessagesCopy
    readonly decidingId: string | null
    readonly onPin: ((messageId: string, pinned: boolean) => void) | undefined
    readonly onDecide: (decisionId: string, verdict: "approved" | "refused") => void
    readonly stops: TeamChatStopHandlers | undefined
    readonly changes: TeamChatBrainChangeHandlers | undefined
    readonly onReact: ((messageId: string, emoji: string) => void) | undefined
    readonly onReply: ((messageId: string) => void) | undefined
    readonly onShare: ((messageId: string) => void) | undefined
}

/** One message: a centred system line, a card of an agent, or a bubble of a person. */
export const MessageRow = (props: MessageRowProps) => {
    const { row } = props
    if (row.backgroundStopped != null) return <TeamChatBackgroundStoppedCard card={row.backgroundStopped} />
    if (row.brainChange != null) {
        return (
            <TeamChatBrainChangeCard
                row={row}
                card={row.brainChange}
                copy={props.copy}
                changes={props.changes}
                onReact={props.onReact}
                onReply={props.onReply}
                onShare={props.onShare}
            />
        )
    }
    if (row.kind === "system") {
        return <ChatSystemLine text={row.body} />
    }
    if (row.stop != null) {
        return (
            <TeamChatStopCard
                row={row}
                card={row.stop}
                copy={props.copy}
                stops={props.stops}
                onReact={props.onReact}
                onReply={props.onReply}
                onShare={props.onShare}
            />
        )
    }
    if (row.card !== null) {
        return (
            <TeamChatAgentCard
                row={row}
                copy={props.copy}
                isDeciding={row.approval !== null && props.decidingId === row.approval.decisionId}
                onPin={props.onPin}
                onDecide={props.onDecide}
                onReact={props.onReact}
                onReply={props.onReply}
                onShare={props.onShare}
            />
        )
    }
    return (
        <TeamChatBubble
            row={row}
            copy={props.copy}
            onPin={props.onPin}
            onReact={props.onReact}
            onReply={props.onReply}
            onShare={props.onShare}
        />
    )
}
