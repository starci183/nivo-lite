import type { AgentSetupProposal } from "./setupSide"
import type { SetupWrite, SetupWriteInstance, SetupWriteWords } from "./setup-write"
import type { TeamChatComposerProps, TeamChatMessageRow } from "./team-chat"

/** The composer in the shape of the team chat composer, without its commands. */
type AgentSetupComposerView = Omit<
    TeamChatComposerProps,
    "onDraft" | "onMention" | "onSend" | "onFile" | "onFileClear" | "onReplyClear"
>

/**
 * What the setup chat draws once the setup is in: the messages of the setup session as rows of the shared chat thread, the cards
 * under NIVO's replies, the lines about a turn in flight, and the composer in the shape of the shared composer.
 */
export interface AgentSetupChatContent {
    readonly emptyTitle: string
    readonly emptyBody: string
    /** The messages of the setup session in the view model of the shared chat thread. */
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    /** The confirm cards of the facts NIVO wants to write, by the id of the reply they stand under. */
    readonly writes: Readonly<Record<string, ReadonlyArray<SetupWrite>>>
    /** The newest reply of NIVO, under which the proposals stand; empty before NIVO answered. */
    readonly latestReplyId: string
    readonly instance: SetupWriteInstance | null
    readonly sendingLabel: string
    readonly isSending: boolean
    /** The last owner message waited past the timeout without a reply: the owner may write again. Empty when no turn was lost. */
    readonly staleLabel: string
    /** The words of the confirm cards under the replies. */
    readonly words: SetupWriteWords
    /** The card being settled now; empty when none. */
    readonly decidingId: string
    /** The gates NIVO proposed, drawn under its latest reply. */
    readonly proposals: ReadonlyArray<AgentSetupProposal>
    /** The next missing gates as one-tap starts of a message. */
    readonly suggestions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly composer: AgentSetupComposerView
}
