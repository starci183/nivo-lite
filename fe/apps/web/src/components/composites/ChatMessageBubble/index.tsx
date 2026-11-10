import type { ReactNode } from "react"
import { MessageBubble } from "@starci/grammar/common"
import type { MessageBubbleGroupPosition } from "@starci/grammar/common"

/** One message of a conversation as the bubble of the team chat and of the journey of a customer draw it. */
export interface ChatMessageBubbleProps {
    readonly id?: string
    /** `outgoing` sits at the end (the reader's or the shop's side), `incoming` at the start. */
    readonly side: "incoming" | "outgoing"
    /** `soft` is an agent speaking for the reader; the brand fill when omitted. */
    readonly tone?: "brand" | "soft"
    /** Who wrote it, above the body. */
    readonly author?: string | undefined
    /** The mark beside an incoming bubble. */
    readonly avatar?: ReactNode | undefined
    /** The time, muted after the author. */
    readonly meta?: string
    /** A short marker beside the author. */
    readonly status?: ReactNode | undefined
    /** The tools of the message, shown on hover. */
    readonly actions?: ReactNode | undefined
    /** What sits under the words (files). */
    readonly footer?: ReactNode | undefined
    readonly body: ReactNode
    /** Where the bubble stands in a run from one sender (Messenger grouping); `single` when omitted. */
    readonly groupPosition?: MessageBubbleGroupPosition
    /** `card`: the body is a structured card on the surface face, not words in the bubble. */
    readonly content?: "text" | "card"
}

/**
 * The one bubble of every conversation the console draws: a wide measure, tools bare beside the bubble. The team chat and the journey of
 * a customer both draw their messages through it, so a message looks the same wherever it is read.
 */
export const ChatMessageBubble = (props: ChatMessageBubbleProps) => (
    <MessageBubble
        {...(props.id === undefined ? {} : { id: props.id })}
        {...(props.tone === undefined ? {} : { tone: props.tone })}
        {...(props.groupPosition === undefined ? {} : { groupPosition: props.groupPosition })}
        {...(props.content === undefined ? {} : { content: props.content })}
        side={props.side}
        measure="wide"
        actionsPlacement="inline"
        author={props.author}
        avatar={props.avatar}
        meta={props.meta}
        status={props.status}
        actions={props.actions}
        footer={props.footer}
        body={props.body}
    />
)
