import { z } from "zod"
import type { AgentMessageKind } from "./agent-message-kinds"

/*
 * The core kinds the ENGINE posts with no tool call behind them (owner chot 2026-11-13, nivo-frame `team-chat` rule 10): a change of
 * the truth graph (`brain.change`), a background work that stopped (`background.stopped`) and a chain of agents that stopped at its
 * limit (`chain.stopped`). Their payload schemas live here so every client reads the same contract; the engine builds them.
 * They are plain objects (not `defineAgentMessageKind` calls) so this file imports only types of `agent-message-kinds`, which lists them.
 */

/**
 * The typed chat message `brain.change` (BRAIN wave, package BG4; owner 2026-11-11: "while chatting, the agent prints a message that
 * changes the truth graph, with its reason"): an agent tells the founder that something said in a chat, learnt from repeated human answers, or read in a
 * document changes a truth of the shop. It shows the truth, the value in force -> the proposed one, the reason in the agent's own words,
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
     * the agent or by its exact key), shown "Current" (Vietnamese UI); `near` = a value of ANOTHER truth near in meaning, shown "may replace": the
     * founder's Approve replaces it, "Keep both" keeps both.
     */
    readonly match?: BrainChangeMatch | undefined
    /** The truth the value in force belongs to (it differs from the card's `factKey` when `match` is `near`). */
    readonly factKey?: BrainChangeFactKey | undefined
    /**
     * D-BR-6 (additive; absent on older cards and for a value in force now): the value is not in force yet but PLANNED from this instant
     * (ISO), shown "applies from dd/MM". The change is filed as the next version of that planned value: approving a change that starts
     * later replaces the plan (one plan per truth), approving one that starts now leaves the plan to take over at its start.
     */
    readonly startsAt?: string | undefined
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
    /** The subject (for example "Delivery"). */
    readonly subjectLabel: string
    /** The attribute (for example "Inner-city shipping fee"). */
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

/** The most pieces of evidence a card keeps (learning lists the similar answers; a chat card gains one per repeated message). */
export const BRAIN_CHANGE_EVIDENCE_MAX = 20

/** One piece of evidence. */
const brainChangeEvidence = z.object({
    kind: z.enum(BRAIN_CHANGE_EVIDENCE_KINDS),
    quote: z.string().min(1).max(500),
    ref: z.string().min(1).max(300),
    by: z.object({ name: z.string().max(200), memberId: z.string().max(100).nullable() }),
    at: z.string().max(40).nullable(),
})

/** A truth as people write it. */
const brainChangeFactKey = z.object({ subjectLabel: z.string().min(1).max(160), attributeLabel: z.string().min(1).max(120) })

/** The members of a `brain.change` payload as a writer builds it, the shape both exported schemas start from. */
const brainChangeGivenObject = z.object({
    version: z.literal(1),
    changeId: z.string().min(1).max(100),
    origin: z.enum(BRAIN_CHANGE_ORIGINS),
    kind: z.enum(BRAIN_CHANGE_KINDS),
    factKey: brainChangeFactKey,
    oldValue: z.string().max(500).nullable(),
    current: z
        .object({
            value: z.string().max(500),
            version: z.number().int().nullable(),
            source: z.string().max(300),
            match: z.enum(BRAIN_CHANGE_MATCHES).optional(),
            factKey: brainChangeFactKey.optional(),
            startsAt: z.string().max(40).optional(),
        })
        .nullable(),
    newValue: z.string().max(500),
    unit: z.string().max(20).nullable(),
    validFrom: z.string().max(40).nullable(),
    validTo: z.string().max(40).nullable(),
    reason: z.string().min(1).max(1000),
    evidence: z.array(brainChangeEvidence).min(1).max(BRAIN_CHANGE_EVIDENCE_MAX),
    state: z.enum(BRAIN_CHANGE_STATES),
    decidedBy: z.object({ memberId: z.string().max(100), name: z.string().max(200), at: z.string().max(40) }).nullable(),
    supersededBy: z.string().max(100).nullable(),
})

/** The payload of a `brain.change` card as a writer builds it (no revision: the card counts it): the shared members, nothing added. */
export const brainChangePayloadGiven: z.ZodType<BrainChangePayloadGiven> = brainChangeGivenObject.extend({})

/** The payload as the card stores it: one more member, how many times the card was written. */
export const brainChangePayload: z.ZodType<BrainChangePayload> = brainChangeGivenObject.extend({
    revision: z.number().int().min(1),
})

/** A change of a truth of the shop, for the founder to decide: Approve applies it (owner only), Reject turns it down. Core only. */
export const brainChangeKind: AgentMessageKind<z.ZodType<BrainChangePayload>> = {
    id: "brain.change",
    payload: brainChangePayload,
    actions: { approve: true, edit: "none", reject: true },
}

/**
 * The background works NIVO reports when they stop with no agent and no run behind them: the policy derive pass, the truths work
 * of an uploaded document (triage, reading, putting in force), and the upkeep of the meaning index (search by meaning falls back to
 * words while it is out of step).
 */
export const BACKGROUND_WORKS = ["brain.policies.derive", "brain.documents.truths", "brain.vectors.sync"] as const

/** One background work, by its stable key (the web words it as `chat.backgroundStopped.work.<key>`). */
export type BackgroundWork = (typeof BACKGROUND_WORKS)[number]

/**
 * Why a background work stopped: the AI gave nothing usable, the workspace has no credits, the queue's retries ran out, or the business
 * holds its ceiling of truths in force (the rest of a document's truths wait as proposals).
 */
export const BACKGROUND_STOP_REASONS = ["model", "credits", "gave_up", "ceiling"] as const

/** One reason code (the web words it as `chat.backgroundStopped.reason.<code>`). */
export type BackgroundStopReason = (typeof BACKGROUND_STOP_REASONS)[number]

/** Where the founder retries a stopped work: a place of the web, by key (the web words it as `chat.backgroundStopped.action.<key>`). */
export const BACKGROUND_TARGETS = ["brain.policies", "brain.documents"] as const

/** One place a stopped work is retried at. */
export type BackgroundTarget = (typeof BACKGROUND_TARGETS)[number]

/** Where the founder retries a stopped work. */
export interface BackgroundStoppedTarget {
    /** The place, by key. */
    readonly kind: BackgroundTarget
}

/** The payload of a `background.stopped` card: codes and keys only, never words (the web words them). */
export interface BackgroundStoppedPayload {
    /** The shape of this payload. */
    readonly version: 1
    /** What stopped. */
    readonly work: BackgroundWork
    /** Why it stopped. */
    readonly reason: BackgroundStopReason
    /** When it stopped, ISO. */
    readonly since: string
    /** The failure episode the card is about (for the derive pass: when the pass that failed was asked for, ISO). */
    readonly episode: string
    /** Where the founder retries it. */
    readonly target: BackgroundStoppedTarget
}

/** The payload of a `background.stopped` card as it is stored. */
export const backgroundStoppedPayload: z.ZodType<BackgroundStoppedPayload> = z.object({
    version: z.literal(1),
    work: z.enum(BACKGROUND_WORKS),
    reason: z.enum(BACKGROUND_STOP_REASONS),
    since: z.string().min(1).max(40),
    episode: z.string().min(1).max(40),
    target: z.object({ kind: z.enum(BACKGROUND_TARGETS) }),
})

/** NIVO's "a background work stopped" card: it only tells; the retry is the target's own door. Read only. */
export const backgroundStoppedKind: AgentMessageKind<z.ZodType<BackgroundStoppedPayload>> = {
    id: "background.stopped",
    payload: backgroundStoppedPayload,
    actions: { approve: false, edit: "none", reject: false },
}

/** The payload of a `chain.stopped` line: how deep the chain of agent wakes went, why it stopped, and the event type. */
export interface ChainStoppedPayload {
    /** The shape of this payload. */
    readonly version: 1
    /** How many agent wakes led to the event. */
    readonly depth: number
    /** Why it stopped. */
    readonly reason: string
    /** The event type. */
    readonly eventType: string
}

/** The payload of a `chain.stopped` line as it is stored. */
export const chainStoppedPayload: z.ZodType<ChainStoppedPayload> = z.object({
    version: z.literal(1),
    depth: z.number().int().min(0),
    reason: z.string().max(200),
    eventType: z.string().max(200),
})

/** The line of an agent that was not woken because its chain of agents stopped at its limit. Read only. */
export const chainStoppedKind: AgentMessageKind<z.ZodType<ChainStoppedPayload>> = {
    id: "chain.stopped",
    payload: chainStoppedPayload,
    actions: { approve: false, edit: "none", reject: false },
}
