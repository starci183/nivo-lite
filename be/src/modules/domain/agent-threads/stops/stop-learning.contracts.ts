import type { LessonFactKey, StopLearningConfig } from "@modules/domain/brain-lessons"

/**
 * The token of the poster of truth-graph change cards: BG4's `BrainChangeMessagesService`, bound by the app's wiring
 * (`{ provide: STOP_LEARNING_CARDS, useExisting: BrainChangeMessagesService }`). Absent: answers are kept, nothing is posted.
 */
export const STOP_LEARNING_CARDS = "STOP_LEARNING_CARDS"

/** BG4's `BrainChangePost`, as the learning sends it (structural: the brain module is not imported here). */
export interface ChangeCardPost {
    /** The workspace. */
    readonly workspaceId: string
    /** The proposed fact the card is about. */
    readonly changeId: string
    /** Always `learning`: the card comes from repeated answers to stops. */
    readonly origin: "learning"
    /** Why the truth is proposed, in the engine's words. */
    readonly reason: string
    /** The answers the truth rests on. */
    readonly evidence: ReadonlyArray<ChangeCardEvidence>
    /** The agent that asked: the card goes to the founder's direct room with it. */
    readonly agentId: string
    /** Always null: the poster picks the founder's direct room with the agent. */
    readonly roomId: null
}

/** Who answered a stop, as a card names them. */
export interface EvidenceAuthor {
    /** The display name. */
    readonly name: string
    /** The account, or null when it cannot be read. */
    readonly memberId: string | null
}

/** One answer a change card rests on, as BG4 takes it. */
export interface ChangeCardEvidence {
    /** Always `answer`: a person's answer to a stop. */
    readonly kind: "answer"
    /** The person's words. */
    readonly quote: string
    /** The run and the step. */
    readonly ref: string
    /** Who answered. */
    readonly by: EvidenceAuthor
    /** When, ISO, or null. */
    readonly at: string | null
}

/** BG4's `BrainChangePosted`, as far as the learning reads it. */
export interface ChangeCardPosted {
    /** What became of the card: posted, rewritten in place, no longer waiting, or no room to post in. */
    readonly outcome: "posted" | "updated" | "not_waiting" | "no_room"
}

/** BG4's poster, as far as the learning uses it. */
export interface ChangeCardPoster {
    /** Posts the card of a change, or rewrites the one already posted. */
    post(change: ChangeCardPost): Promise<ChangeCardPosted>
}

/** The token of the "too often" config (optional; the defaults are two answered stops within 30 days). */
export const STOP_LEARNING_CONFIG = "STOP_LEARNING_CONFIG"

/**
 * One item of what a learned truth rests on: a person's answer to a stop (owner's drawing, part A: who · when · the words). `ref` names
 * the run and the step (`run:<runId>/step:<stepKey>`).
 */
export interface LearningEvidence {
    /** Always `answer` (BG4's evidence kind for a person's answer to a stop). */
    readonly kind: "answer"
    /** The person's words, verbatim (phones and e-mails masked). */
    readonly quote: string
    /** The run and the step. */
    readonly ref: string
    /** Who answered. */
    readonly by: EvidenceAuthor
    /** When, ISO. */
    readonly at: string
}

/** How long a learned truth holds; null = the truth graph's default (one year). */
export interface LearningValidity {
    /** From, ISO date, or null = from the founder's yes. */
    readonly from: string | null
    /** Until, ISO date, or null = one year. */
    readonly to: string | null
}

/**
 * A truth-graph change the learning asks the door to post, the frozen `brain.change` payload without what the door sets itself
 * (`changeId`, `state`, `decidedBy`, `revision`): origin `learning`, posted for the agent that asked into the founder's private room
 * with it. It never applies anything: only the founder's yes on the card does.
 */
export interface LearningChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that asked (the founder's private room with it). */
    readonly agentId: string
    /** Always `learning`. */
    readonly origin: "learning"
    /** The truth's key. */
    readonly factKey: LessonFactKey
    /** The value in force today, when the learning knows it; null lets the door read it (`current`). */
    readonly oldValue: string | null
    /** The proposed value. */
    readonly newValue: string
    /** Its unit, or null. */
    readonly unit: string | null
    /** How long it holds, or null for the default. */
    readonly validity: LearningValidity | null
    /** The reason, in plain Vietnamese, written by the engine. */
    readonly reason: string
    /** The answered stops it rests on. */
    readonly evidence: ReadonlyArray<LearningEvidence>
}

/** What the door answers for a posted change. */
export interface LearningChangePosted {
    /** The change id: the proposed fact the card is about. */
    readonly changeId: string
    /** `open`: the card waits for the founder; `already_true`: the truth already holds this value; `not_posted`: no room to post in. */
    readonly state: "open" | "already_true" | "not_posted"
}

/** Where a change stands in the truth graph. */
export type LearningChangeState = "open" | "applied" | "rejected" | "gone"

/** The founder's decision on a card, as the door tells it. */
export interface LearningChangeDecided {
    /** The workspace. */
    readonly workspaceId: string
    /** The change. */
    readonly changeId: string
    /** What became of it. */
    readonly state: "applied" | "rejected" | "superseded"
    /** The truth now in force (applied), or null. */
    readonly factId: string | null
}

/** The door of the truth-graph change cards, as the learning uses it. */
export interface LearningChangeDoor {
    /** Whether a card can be posted at all in this app. */
    available(): boolean
    /** Files the proposal (never applied) and posts its one card. */
    post(change: LearningChange): Promise<LearningChangePosted>
    /** Where a change stands now (the founder may have decided on the card or on the Second Brain page). */
    stateOf(workspaceId: string, changeId: string): Promise<LearningChangeState>
}

/** The "too often" config as the app may bind it: any member left out keeps its default. */
export type StopLearningOptions = Partial<StopLearningConfig>

/** What one settle of a thread did for learning (counts only; for logs and specs). */
export interface StopLearningPass {
    /** Answers kept as new candidates. */
    readonly kept: number
    /** Cards posted. */
    readonly posted: number
}
