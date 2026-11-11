/**
 * The typed chat message `brain.change` (BRAIN wave, package BG4; owner 2026-11-11: "trong quá trình nhắn agent thì agent in ra message
 * sửa truth graph và lí do"): an agent tells the founder that something said in a chat, learnt from repeated human answers, or read in a
 * document changes a truth of the shop. It shows the truth, the value in force → the proposed one, the reason in the agent's own words,
 * the evidence and where it stands. It never applies anything by itself: only the workspace owner applies (W2's founder-only rule). ONE
 * card per change request, rewritten in place on every change of state (`revision` counts the writes), never a second card.
 */

/** Where the proposal came from: words said in a chat, a lesson learnt from repeated human answers, or a document. */
export const BRAIN_CHANGE_ORIGINS = ["chat", "learning", "document"] as const

/** Where the proposal came from. */
export type BrainChangeOrigin = (typeof BRAIN_CHANGE_ORIGINS)[number]

/** What the proposal does: a new value for a truth in force, a truth the graph does not hold yet, or stop using a truth. */
export const BRAIN_CHANGE_KINDS = ["change", "add", "retire"] as const

/** What the proposal does. */
export type BrainChangeKind = (typeof BRAIN_CHANGE_KINDS)[number]

/**
 * Where the card stands. `open`: it waits for the founder. `applied` / `rejected`: decided (on the card or on the Second Brain page).
 * `superseded`: a newer proposal for the same truth came while this one was open; that one carries the decision.
 */
export const BRAIN_CHANGE_STATES = ["open", "applied", "rejected", "superseded"] as const

/** Where the card stands. */
export type BrainChangeState = (typeof BRAIN_CHANGE_STATES)[number]

/** What a piece of evidence is: a chat message, a person's answer to a stop (learning), or a passage of a document. */
export const BRAIN_CHANGE_EVIDENCE_KINDS = ["message", "answer", "document"] as const

/** What a piece of evidence is. */
export type BrainChangeEvidenceKind = (typeof BRAIN_CHANGE_EVIDENCE_KINDS)[number]

/** Who said or wrote the words of a piece of evidence: a name for people, and the account when it is a member. */
export interface BrainChangeAuthor {
    /** The name people read (a member's display name, or a document title). */
    readonly name: string
    /** The account (user id) of the member who said it; null for a document or someone outside the workspace. */
    readonly memberId: string | null
}

/** One piece of evidence the proposal rests on, verbatim. */
export interface BrainChangeEvidence {
    /** What it is. */
    readonly kind: BrainChangeEvidenceKind
    /** The words, verbatim. */
    readonly quote: string
    /** Where it lives (`team-chat:<message>`, `agent.run-stop:<stop>`, `knowledge-source:<source>#<chunk>`). */
    readonly ref: string
    /** Who said or wrote it. */
    readonly by: BrainChangeAuthor
    /** When, ISO; null when unknown. */
    readonly at: string | null
}

/** The value in force the proposal would replace: the value, its version and where it came from. */
export interface BrainChangeCurrent {
    /** The value in force. */
    readonly value: string
    /** Its version; null on a row the version backfill did not reach. */
    readonly version: number | null
    /** Where it came from, for people (a document title, "chat", a person's name). */
    readonly source: string
    /**
     * How the value was found (FX5, additive; absent on cards written before): `same` = the value in force of the same truth (named by
     * the agent or by its exact key), shown "Hiện tại"; `near` = a value of ANOTHER truth near in meaning, shown "có thể thay cho": the
     * founder's Đồng ý replaces it, "Giữ cả hai" keeps both.
     */
    readonly match?: BrainChangeMatch | undefined
    /** The truth the value in force belongs to (it differs from the card's `factKey` when `match` is `near`). */
    readonly factKey?: BrainChangeFactKey | undefined
}

/** How the value in force a card shows was found: the same truth, or another truth near in meaning. */
export const BRAIN_CHANGE_MATCHES = ["same", "near"] as const

/** How the value in force a card shows was found. */
export type BrainChangeMatch = (typeof BRAIN_CHANGE_MATCHES)[number]

/** Who decided the card and when. */
export interface BrainChangeDecided {
    /** The account (user id) of the member who decided. */
    readonly memberId: string
    /** Their display name when they decided. */
    readonly name: string
    /** When, ISO. */
    readonly at: string
}

/** The truth a proposal is about, as people write it. */
export interface BrainChangeFactKey {
    /** The subject ("Giao hàng"). */
    readonly subjectLabel: string
    /** The attribute ("Phí ship nội thành"). */
    readonly attributeLabel: string
}

/** The payload of a `brain.change` card as stored (the frozen contract of the BRAIN wave plus additive members). */
export interface BrainChangePayload {
    /** The shape of this payload; 1 today. */
    readonly version: 1
    /** The change request: the proposed fact of the truth graph. */
    readonly changeId: string
    /** Where it came from. */
    readonly origin: BrainChangeOrigin
    /** What it does. */
    readonly kind: BrainChangeKind
    /** The truth. */
    readonly factKey: BrainChangeFactKey
    /** The value in force (= `current.value`), or null for a new truth (frozen contract member). */
    readonly oldValue: string | null
    /** The value in force with its version and source, or null for a new truth. */
    readonly current: BrainChangeCurrent | null
    /** The proposed value; empty for `retire`. */
    readonly newValue: string
    /** The unit, when written apart from the value. */
    readonly unit: string | null
    /** From when the new value holds, when said. */
    readonly validFrom: string | null
    /** Until when it holds, when said; else one year from the approval. */
    readonly validTo: string | null
    /** Why the truth changes, in the agent's own plain words. */
    readonly reason: string
    /** The words it rests on, oldest first. */
    readonly evidence: ReadonlyArray<BrainChangeEvidence>
    /** Where it stands. */
    readonly state: BrainChangeState
    /** Who decided and when; null while open or superseded. */
    readonly decidedBy: BrainChangeDecided | null
    /** The newer change request that superseded this one; null otherwise. */
    readonly supersededBy: string | null
    /** How many times the card was written. */
    readonly revision: number
}

/** The payload as a writer builds it: the revision is counted against the card already stored. */
export type BrainChangePayloadGiven = Omit<BrainChangePayload, "revision">

/** Who views a card: the workspace owner decides, a manager may only turn it down, anyone else reads. */
export type BrainChangeViewerRole = "owner" | "manager" | "member"

/** A `brain.change` card as one viewer sees it: the payload and the two controls this viewer gets. */
export interface BrainChangeCardView extends Omit<BrainChangePayload, "version"> {
    /** Whether this viewer is offered "Đồng ý": the workspace owner while the card is open. */
    readonly canApprove: boolean
    /** Whether this viewer is offered "Không": the owner or a manager while the card is open. */
    readonly canReject: boolean
    /**
     * Whether this viewer is offered "Giữ cả hai" (FX5): the workspace owner while the card is open and its value in force is only a
     * near-meaning candidate (`current.match` = `near`): the new value goes in force as its own truth and the other one stays.
     */
    readonly canKeepBoth: boolean
    /** What producing the proposal cost in AI (U1); null for a viewer who is not an owner or manager, or when no cost is known. */
    readonly cost: BrainChangeCost | null
}

/** What producing a change request cost in AI, exact: credits are a fraction of the exact USD, never rounded per call. */
export interface BrainChangeCost {
    /** The credits, an exact fraction. */
    readonly credits: number
    /** The exact cost in USD. */
    readonly usd: number
}
