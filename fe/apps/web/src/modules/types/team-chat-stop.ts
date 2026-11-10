import type { TeamChatMarkView } from "./team-chat-room"

/** What a run stop card is about: the AI asks, NIVO reports an AI failure, or a step asks leave to use an ability. */
export type TeamChatStopKind = "ai_report" | "ai_error" | "approval"

/** Where a stop card stands in its life; the engine rewrites the same card in place. */
export type TeamChatStopState = "open" | "answered" | "skipped" | "timed_out" | "resolved"

/** What a person may do with an open AI stop besides answering it. */
export type TeamChatStopDecision = "retry" | "take_over" | "skip"

/** The verdicts of a leave request, answered through its work item. */
export type TeamChatStopVerdict = "approve" | "refuse"

/** One reply on a stop card, as the door reads it. */
export type TeamChatStopReplyKind = "answer" | "approve" | "refuse" | "retry" | "skip" | "take_over" | "timeout"

/** One name/value line of a stop (an engine fact, an argument of a leave request). */
export interface TeamChatStopFact {
    readonly name: string
    readonly value: string
}

/** The typed `workflow.stopped` card of a message, as the chat door reads it (`ChatMessageType.stop`). */
export interface TeamChatStop {
    readonly runId: string
    readonly stepKey: string
    readonly stepTitle: string
    readonly workflowTitle: string
    readonly kind: TeamChatStopKind
    readonly by: "ai" | "engine"
    readonly state: TeamChatStopState
    readonly headline: string
    readonly message: string
    readonly question: string | null
    readonly suggestions: ReadonlyArray<{ readonly text: string }>
    readonly facts: ReadonlyArray<TeamChatStopFact>
    readonly needs: {
        readonly answer: boolean
        readonly decisions: ReadonlyArray<TeamChatStopDecision>
        readonly verdicts: ReadonlyArray<TeamChatStopVerdict>
    }
    readonly replies: ReadonlyArray<{
        readonly kind: TeamChatStopReplyKind
        readonly text: string | null
        readonly byName: string
        readonly at: string
    }>
    readonly repeats: number
    readonly stoppedAt: string
    readonly resolvedAt: string | null
    readonly approval: {
        readonly workItemId: string
        readonly tool: string
        readonly account: string
        readonly ability: string
        readonly args: ReadonlyArray<TeamChatStopFact>
    } | null
    readonly revision: number
}

/** The tone of the state chip of a stop card, from Grammar's Badge tones. */
export type TeamChatStopChipTone = "accent" | "neutral" | "success" | "warning"

/** One key/value row a stop card draws in a bordered list. */
export interface TeamChatStopLineView {
    readonly id: string
    readonly name: string
    readonly value: string
}

/** One reply of the trace: what was said (or done), then who and when. */
export interface TeamChatStopReplyView {
    readonly id: string
    readonly title: string
    readonly line: string
}

/** The words a stop card draws that the web owns: buttons, list names, the composer. */
export interface TeamChatStopLabels {
    readonly retry: string
    readonly takeOver: string
    readonly skip: string
    readonly send: string
    readonly approve: string
    readonly refuse: string
    readonly details: string
    readonly answerLabel: string
    readonly answerPlaceholder: string
    readonly contextPlaceholder: string
    readonly ownerOnly: string
    readonly traceLabel: string
    readonly factsLabel: string
    readonly approvalLabel: string
    readonly suggestionsLabel: string
    readonly decisionsLabel: string
}

/** A stop card with every word resolved: what it says, what it shows, and which controls the engine accepts now. */
export interface TeamChatStopCardView {
    /** The run and step the card is about: the decide door names them. */
    readonly runId: string
    readonly stepKey: string
    /** The key of the card an action is in flight on (`runId:stepKey`). */
    readonly key: string
    /** The mark of the agent beside the card. */
    readonly mark: TeamChatMarkView
    /** Grows with every rewrite: a new revision clears what the viewer typed. */
    readonly revision: number
    /** The muted line under the agent: the workflow, the step, the time, and how many times it stopped. */
    readonly meta: string
    readonly chip: { readonly label: string; readonly tone: TeamChatStopChipTone }
    readonly headline: string
    readonly message: string
    readonly question: string | null
    /** The texts a press sends as the answer; only while the card is open. */
    readonly suggestions: ReadonlyArray<string>
    readonly canAnswer: boolean
    /** The engine's own placeholder for the answer: AI errors ask for context, reports for an answer. */
    readonly answerPlaceholder: string
    readonly decisions: ReadonlyArray<TeamChatStopDecision>
    readonly verdicts: ReadonlyArray<TeamChatStopVerdict>
    /** The work item of a leave request and its lines (account, ability, the call's arguments); null for any other card. */
    readonly approval: { readonly workItemId: string; readonly lines: ReadonlyArray<TeamChatStopLineView> } | null
    /** The engine facts, folded behind "Details" (they may carry raw codes). */
    readonly facts: ReadonlyArray<TeamChatStopLineView>
    readonly replies: ReadonlyArray<TeamChatStopReplyView>
    readonly labels: TeamChatStopLabels
}

/** What a person does on a stop card: one of the decide door's actions, or a verdict on the work item of a leave request. */
export type TeamChatStopAction =
    | { readonly kind: "answer"; readonly text: string }
    | { readonly kind: "decision"; readonly decision: TeamChatStopDecision }
    | { readonly kind: "verdict"; readonly verdict: TeamChatStopVerdict }

/** What the thread does with the stop cards: who may approve, which card is in flight, and the one handler. */
export interface TeamChatStopHandlers {
    /** The viewer is the workspace owner: only the owner sees Approve on a leave request. */
    readonly isOwner: boolean
    /** The run and step of the card whose action is in flight (`runId:stepKey`), or null. */
    readonly pendingKey: string | null
    readonly onAction: (card: TeamChatStopCardView, action: TeamChatStopAction) => void
}
