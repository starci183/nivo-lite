import type {
    BrainChangeCardView,
    BrainChangeCost,
    BrainChangeDecided,
    BrainChangeEvidence,
    BrainChangePayload,
    BrainChangePayloadGiven,
    BrainChangeViewerRole,
} from "./brain-change-card.contracts"
import { BRAIN_CHANGE_EVIDENCE_MAX, brainChangePayload } from "./brain-change-card.schema"
import type { TeamCardMessage } from "./team-chat-audience.contracts"
import { lineClientIdOf } from "./team-chat.policy"

/** The kind of a truth-graph change card. */
export const BRAIN_CHANGE_MESSAGE_KIND = "brain.change"

/** What a value reads as on the card's one line when there is none. */
const NONE = "-"

/** The client id of the ONE card of a change request: the same change request always names the same line. */
export const brainChangeKeyOf = (changeId: string): string => lineClientIdOf(`brain-change:${changeId}`)

/** The key a piece of evidence is told apart by: the same words at the same place are one piece. */
const evidenceKeyOf = (one: BrainChangeEvidence): string => `${one.ref}\u0000${one.quote}`

/** The evidence of a card written again: what it held, then what is new, at most the bound (the newest kept). */
export const mergedEvidenceOf = (
    before: ReadonlyArray<BrainChangeEvidence>,
    now: ReadonlyArray<BrainChangeEvidence>,
): ReadonlyArray<BrainChangeEvidence> => {
    const seen = new Set(before.map(evidenceKeyOf))
    const added = now.filter((one) => !seen.has(evidenceKeyOf(one)))
    return [...before, ...added].slice(-BRAIN_CHANGE_EVIDENCE_MAX)
}

/**
 * The payload to store: the writer's, counted one write after the card stored before. A card written again for the same change request
 * keeps the evidence it held and adds the new pieces.
 */
export const countedPayloadOf = (
    given: BrainChangePayloadGiven,
    before: BrainChangePayload | null,
): BrainChangePayload => ({
    ...given,
    evidence: before === null ? given.evidence : mergedEvidenceOf(before.evidence, given.evidence),
    revision: (before?.revision ?? 0) + 1,
})

/** The card decided: applied or turned down by a member, nothing asked any more, one write more. */
export const decidedPayloadOf = (
    payload: BrainChangePayload,
    state: "applied" | "rejected",
    decidedBy: BrainChangeDecided,
): BrainChangePayload => ({ ...payload, state, decidedBy, revision: payload.revision + 1 })

/** The card of a change request a newer one for the same truth replaced while it was open: read-only, one write more. */
export const supersededPayloadOf = (payload: BrainChangePayload, newerId: string): BrainChangePayload => ({
    ...payload,
    state: "superseded",
    supersededBy: newerId,
    revision: payload.revision + 1,
})

/** The one line the chat shows where no card is drawn: the truth, the value in force and the proposed one. */
export const brainChangeLineOf = (payload: BrainChangePayload): string => {
    const unit = payload.unit === null ? "" : ` ${payload.unit}`
    const next = payload.kind === "retire" ? NONE : `${payload.newValue}${unit}`
    return `${payload.factKey.subjectLabel} · ${payload.factKey.attributeLabel}: ${payload.oldValue ?? NONE} → ${next}`
}

/** The message of the card: asks while open, only tells after; never a one-tap reply (the decision goes through its own door). */
export const brainChangeMessageOf = (payload: BrainChangePayload): TeamCardMessage => ({
    kind: BRAIN_CHANGE_MESSAGE_KIND,
    intent: payload.state === "open" ? "ask" : "notify",
    title: `${payload.factKey.subjectLabel} · ${payload.factKey.attributeLabel}`,
    summary: brainChangeLineOf(payload),
    payload,
    options: [],
})

/** A stored line read as JSON, or undefined when it is none. */
const parsedOf = (agentMessage: string): unknown => {
    try {
        return JSON.parse(agentMessage) as unknown
    } catch {
        return undefined
    }
}

/** The payload of a stored `brain.change` card, or null when the line is no such card or does not read. */
export const storedBrainChangeOf = (agentMessage: string | null): BrainChangePayload | null => {
    if (agentMessage === null) return null
    const envelope = parsedOf(agentMessage)
    if (typeof envelope !== "object" || envelope === null) return null
    if (Reflect.get(envelope, "kind") !== BRAIN_CHANGE_MESSAGE_KIND) return null
    const parsed = brainChangePayload.safeParse(Reflect.get(envelope, "payload"))
    return parsed.success ? parsed.data : null
}

/** The card a stored message carries, or null: the same reading from a card message the server already holds. */
export const brainChangeOfMessage = (message: TeamCardMessage | null): BrainChangePayload | null => {
    if (message?.kind !== BRAIN_CHANGE_MESSAGE_KIND) return null
    const parsed = brainChangePayload.safeParse(message.payload)
    return parsed.success ? parsed.data : null
}

/**
 * A `brain.change` card as one viewer sees it, or null when the line is no such card. Only the workspace owner is offered "Đồng ý"
 * (founder-only apply); the owner and a manager are offered "Không"; anyone else reads it. Nothing is offered once it is not open.
 */
export const brainChangeCardViewOf = (
    agentMessage: string | null,
    viewer: BrainChangeViewerRole,
    costs: ReadonlyMap<string, BrainChangeCost> = new Map(),
): BrainChangeCardView | null => {
    const payload = storedBrainChangeOf(agentMessage)
    if (payload === null) return null
    const { version: _shape, ...shown } = payload
    const open = payload.state === "open"
    // What the proposal cost is shown to the owner and managers only (U1), never to staff.
    const cost = viewer === "member" ? null : (costs.get(payload.changeId) ?? null)
    return {
        ...shown,
        canApprove: open && viewer === "owner",
        canReject: open && viewer !== "member",
        canKeepBoth: open && viewer === "owner" && payload.current?.match === "near",
        cost,
    }
}

/** The changes of the learning cards among stored card texts (their cost is the cost of their lessons), each once, at most `limit`. */
export const learningChangeIdsOf = (
    agentMessages: ReadonlyArray<string | null>,
    limit: number,
): ReadonlyArray<string> =>
    [
        ...new Set(
            agentMessages
                .map((message) => storedBrainChangeOf(message))
                .filter((payload): payload is BrainChangePayload => payload !== null && payload.origin === "learning")
                .map((payload) => payload.changeId),
        ),
    ].slice(0, limit)
