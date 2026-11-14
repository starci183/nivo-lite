import type { TeamChatBackgroundStoppedView } from "./team-chat-background-stopped"
import type { TeamChatBrainChangeView } from "./team-chat-brain-change"
import type { TeamChatMarkView } from "./team-chat-room"
import type { TeamChatStopCardView } from "./team-chat-stop"

/** What a person answers an approval card with. */
export type TeamChatVerdict = "approved" | "refused"

/** Who a room member, a message author or a mention is. */
export type ChatPartyKind = "user" | "agent"

/** A person or an agent the composer may mention, or the new-chat form may pick. */
export interface ChatParty {
    readonly kind: ChatPartyKind
    readonly id: string
    readonly name: string
    /** The picture an agent was given; null draws the NIVO mascot. Absent for a person. */
    readonly picture?: string | null
}

/** One room of the list, with every word resolved. */
export interface TeamChatRoomRow {
    readonly id: string
    readonly kind: "direct" | "group"
    readonly title: string
    /** Who the room is with when it is direct (the mark it wears); null for a group. */
    readonly other: ChatParty | null
    /** The last message in one line (author and text), or the empty line. */
    readonly preview: string
    /** The time of the last message in the short form, or empty. */
    readonly when: string
    /** The room is the viewer's NIVO room: NIVO's mark, no other party, nobody posts in it. */
    readonly isNivo: boolean
    /** The mark the row and the forward list draw: NIVO's own, the person or agent the room is with, else the group glyph. */
    readonly mark: TeamChatMarkView
    readonly unread: number
    readonly mentions: number
    readonly isSelected: boolean
}

/** The state of the decision a card carries. */
export type TeamChatApprovalStatus = "pending" | "approved" | "refused" | "expired"

/** The approval card of a message: one decision, the same one the workbench pane shows. */
export interface TeamChatApprovalView {
    readonly decisionId: string
    readonly status: TeamChatApprovalStatus
    /** Who settled it, empty while pending. */
    readonly decidedBy: string
    readonly decidedAt: string
    /** The viewer holds the right the decide door checks. */
    readonly canDecide: boolean
}

/** One file under a message. */
export interface TeamChatFileView {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** One emoji on a message: everyone's total, and how many times the viewer tapped it (0 when they did not). */
export interface TeamChatReactionView {
    readonly emoji: string
    readonly count: number
    readonly mine: number
}

/** The message a reply quotes. */
export interface TeamChatReplyView {
    readonly messageId: string
    readonly authorName: string
    readonly body: string
}

/** Where a bubble stands in a run of bubbles from one sender. */
export type TeamChatGroupPosition = "single" | "first" | "middle" | "last"

/** One message of the open thread, with every word resolved. */
export interface TeamChatMessageRow {
    readonly id: string
    readonly kind: "text" | "report" | "approval" | "system"
    readonly side: "outgoing" | "incoming"
    readonly author: ChatParty | null
    readonly authorName: string
    readonly body: string
    readonly timeLabel: string
    /** The day it opens when it is the first of its day, else null: the thread draws a divider before it. */
    readonly dayLabel: string | null
    readonly pinned: boolean
    readonly files: ReadonlyArray<TeamChatFileView>
    /** Where the work behind the message opens (the run of a report, the work tab of the agent that asks): null when none is known or its agent is gone. */
    readonly workHref: string | null
    readonly approval: TeamChatApprovalView | null
    /**
     * The record the shared agent message card draws (envelope, kind, intent, payload, the work it opens), for a line of an agent, the
     * approval an engine job asked for and the report of a run; null for any other message, which is a bubble.
     */
    readonly card: Readonly<Record<string, unknown>> | null
    /** The emoji on the message, the most tapped first. */
    readonly reactions: ReadonlyArray<TeamChatReactionView>
    /** The message this one answers; null when it answers none. */
    readonly replyTo: TeamChatReplyView | null
    /** Whose words a forwarded message carries (empty when unknown); null when it was not forwarded. */
    readonly forwardedFrom: string | null
    /** Where the bubble stands in a run from one sender (a gap over three minutes ends a run). */
    readonly groupPosition: TeamChatGroupPosition
    /** The typed stop card of a run (`workflow.stopped`), worded; absent or null for every other message. */
    readonly stop?: TeamChatStopCardView | null
    /** The typed "background work stopped" card NIVO posted, worded; absent or null for every other message. */
    readonly backgroundStopped?: TeamChatBackgroundStoppedView | null
    /** The typed truth-change card (`brain.change`), worded; absent or null for every other message. */
    readonly brainChange?: TeamChatBrainChangeView | null
}

/** The words of the reactions of a message. */
export interface TeamChatReactionCopy {
    /** The name of the toolbar over a bubble. */
    readonly toolbar: string
    readonly reply: string
    readonly share: string
    /** The name of the button of one emoji. */
    readonly react: (emoji: string) => string
    /** The name of the pill from its summary ("emoji 5") and how many times the viewer tapped. */
    readonly pill: (summary: string, mine: number) => string
    /** The line over a forwarded message, and the one over a forward whose first author is unknown. */
    readonly forwarded: (name: string) => string
    readonly forwardedUnknown: string
    /** The line over a reply that names the author it answers. */
    readonly repliedTo: (name: string) => string
}

/** The quote above the field of a draft that answers a message. */
export interface TeamChatComposerReply {
    /** The line that says whom the draft answers. */
    readonly title: string
    /** The first words of the message. */
    readonly body: string
    readonly clearLabel: string
}

/** The words and state of the team chat composer. */
export interface TeamChatComposerProps {
    readonly formLabel: string
    readonly messageLabel: string
    readonly placeholder: string
    readonly sendLabel: string
    readonly draft: string
    /** The line that says who is typing in the room, or null when nobody is. */
    readonly typing: string | null
    /** The file control of the composer; null for a chat with nothing to attach. */
    readonly file: {
        readonly label: string
        readonly removeLabel: string
        readonly accept: string
        /** The name of the file that goes with the message, or null. */
        readonly name: string | null
        /** A room is open to upload to: the first message to an agent opens it, so the control waits until then. */
        readonly canPick: boolean
    } | null
    readonly isSending: boolean
    /** The first read is not in: the field draws as a waiting shape. */
    readonly isLoading: boolean
    /** Nothing is in flight and a room (or an agent to open one with) is there. */
    readonly canSend: boolean
    /** Why the last message was not sent, or null. */
    readonly error: { readonly title: string; readonly text: string } | null
    /** The people and agents the open `@` may name: empty when none is being typed. */
    readonly suggestions: ReadonlyArray<ChatParty>
    /** The message the draft answers, shown above the field; null when it answers none. */
    readonly reply: TeamChatComposerReply | null
    readonly onReplyClear: () => void
    readonly onFile: (file: File) => void
    readonly onFileClear: () => void
    readonly onDraft: (value: string) => void
    readonly onMention: (party: ChatParty) => void
    readonly onSend: () => void
}

/** The words of the cards and controls of a thread. */
export interface TeamChatMessagesCopy {
    readonly pin: string
    readonly unpin: string
    readonly pinned: string
    readonly report: string
    readonly approvalTitle: string
    /** The head of an approval that names its step: "{this} · {step title}". */
    readonly approvalNeeded: string
    /** The words of an approval card's rows and folds. */
    readonly approvalRows: {
        readonly step: string
        readonly account: string
        readonly tool: string
        readonly node: string
        /** The viewer's language: it picks the side of the call's worded label. */
        readonly locale: "vi" | "en"
        readonly details: string
        readonly technical: string
    }
    readonly relatedWork: string
    /** The name of the place the open action of a report or an approval leads to. */
    readonly runName: string
    readonly workName: string
    /** The chip of a message that only tells (an agent notice). */
    readonly intentNotify: string
    /** The words of the key/value rows of an order message and the way to the connections. */
    readonly orderTotal: string
    readonly orderCustomer: string
    readonly orderDeliver: string
    readonly openConnections: string
    readonly agentFrom: string
    readonly approvalPending: string
    readonly approvalApproved: string
    readonly approvalRefused: string
    readonly approvalExpired: string
    readonly approve: string
    readonly refuse: string
    readonly olderLabel: string
    /** The control of a folded run of identical notices: open the repeats, fold them again. A thread that passes none does not fold. */
    readonly noticeOpen?: string
    readonly noticeClose?: string
    /** The head link of an order message that opens the order; absent, the link carries the words the record gave. */
    readonly orderOpen?: string
    /** "by {name}" and "at {time}" are composed from these parts, because module words take no placeholders. */
    readonly decidedBy: string
    readonly reactions: TeamChatReactionCopy
}

/** What a message of the thread does with reactions, replies and forwards. */
export interface MessageReactionActions {
    /** A thread that cannot react (the setup chat) passes none, and the message draws no emoji toolbar. */
    readonly onReact: ((messageId: string, emoji: string) => void) | undefined
    readonly onReply: ((messageId: string) => void) | undefined
    readonly onShare: ((messageId: string) => void) | undefined
}

/** The words of the toolbar and the pill, in the shape the bubble takes them. */
export type BubbleReactionLabels = {
    readonly toolbar: string
    readonly reply: string
    readonly share: string
    readonly react: (emoji: string) => string
    readonly pill: (summary: string, mine: number) => string
}

/** The props of the bubble (and of the card, which lifts them to its bubble) that carry the reactions, the reply, the share and the run position. */
export type BubbleReactionProps = {
    readonly groupPosition: TeamChatMessageRow["groupPosition"]
    readonly reactions: ReadonlyArray<TeamChatReactionView>
    readonly onReact?: (emoji: string) => void
    readonly onReply?: () => void
    readonly onShare?: () => void
    readonly reactionLabels: BubbleReactionLabels
}
