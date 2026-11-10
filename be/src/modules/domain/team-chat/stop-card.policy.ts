import { z } from "zod"
import { workflowStoppedPayload } from "@nivo-lite/blocks-core"
import type { WorkflowStoppedPayload } from "@nivo-lite/blocks-core"
import {
    STOP_CARD_DEADLINE,
    STOP_CARD_DECISIONS,
    STOP_CARD_KINDS,
    STOP_CARD_REPLY_KINDS,
    STOP_CARD_STATES,
    STOP_CARD_VERDICTS,
} from "./stop-card.contracts"
import type { StopCardNeeds, StopCardSection, StopCardSectionGiven, StopCardView } from "./stop-card.contracts"

/** The kind of the card of a stop. */
export const STOP_CARD_MESSAGE_KIND = "workflow.stopped"

/** The member of the card payload the typed part is kept under. */
export const STOP_SECTION_MEMBER = "stop"

/** The most replies one card keeps (the stop record keeps at most 50 answers). */
const REPLIES_MAX = 50

const text = (max: number) => z.string().max(max)

const needsSchema: z.ZodType<StopCardNeeds> = z.object({
    answer: z.boolean(),
    decisions: z.array(z.enum(STOP_CARD_DECISIONS)).max(STOP_CARD_DECISIONS.length),
    verdicts: z.array(z.enum(STOP_CARD_VERDICTS)).max(STOP_CARD_VERDICTS.length),
})

const sectionShape = {
    version: z.literal(1),
    stopId: text(100).nullable(),
    runId: text(100),
    stepKey: text(200),
    kind: z.enum(STOP_CARD_KINDS),
    state: z.enum(STOP_CARD_STATES),
    headline: text(300),
    needs: needsSchema,
    replies: z
        .array(
            z.object({
                kind: z.enum(STOP_CARD_REPLY_KINDS),
                text: text(4000).nullable(),
                by: text(100),
                at: text(40),
            }),
        )
        .max(REPLIES_MAX),
    repeats: z.number().int().min(1),
    stoppedAt: text(40),
    resolvedAt: text(40).nullable(),
}

/** The typed part as the engine hands it (no revision: the team chat counts it). */
export const stopCardSectionGiven: z.ZodType<StopCardSectionGiven> = z.object(sectionShape)

/** The typed part as the card stores it. */
export const stopCardSection: z.ZodType<StopCardSection> = z.object({
    ...sectionShape,
    revision: z.number().int().min(0),
})

/** Nothing is needed: the stop is not open. */
export const NO_NEEDS: StopCardNeeds = { answer: false, decisions: [], verdicts: [] }

/** Whether the engine needs anything from the founder. */
export const needsAnything = (needs: StopCardNeeds): boolean =>
    needs.answer || needs.decisions.length > 0 || needs.verdicts.length > 0

/** The typed part the engine handed under `card.stop`, or null when it handed none or it does not read. */
export const givenSectionOf = (card: unknown): StopCardSectionGiven | null => {
    if (typeof card !== "object" || card === null) return null
    const parsed = stopCardSectionGiven.safeParse(Reflect.get(card, STOP_SECTION_MEMBER))
    return parsed.success ? parsed.data : null
}

/** The typed part a stored card payload keeps, or null (a card of the old engine, or one that does not read). */
export const storedSectionOf = (payload: unknown): StopCardSection | null => {
    if (typeof payload !== "object" || payload === null) return null
    const parsed = stopCardSection.safeParse(Reflect.get(payload, STOP_SECTION_MEMBER))
    return parsed.success ? parsed.data : null
}

/** The section to store: the engine's, counted one write after the one stored before. */
export const countedSectionOf = (given: StopCardSectionGiven, before: StopCardSection | null): StopCardSection => ({
    ...given,
    revision: (before?.revision ?? 0) + 1,
})

/**
 * The card payload to store for a typed stop: the common content as stored, with the asks of the state (the suggestions and the buttons
 * only while the founder is asked) and the typed part. Its `resolvedAt` follows the stop, so a reader of the old payload sees the same.
 */
export const typedPayloadOf = (
    base: WorkflowStoppedPayload,
    section: StopCardSection,
): WorkflowStoppedPayload & { readonly stop: StopCardSection } => {
    const asking = section.state === "open" || needsAnything(section.needs)
    return {
        ...base,
        suggestions: section.state === "open" ? base.suggestions : [],
        decisions: asking ? [...section.needs.decisions] : [],
        repeats: section.repeats,
        resolvedAt: section.resolvedAt,
        stop: section,
    }
}

/** A stored typed part marked resolved by the old resolve path: an open stop becomes `resolved`, nothing is asked, one write more. */
export const resolvedSectionOf = (section: StopCardSection, at: string): StopCardSection => ({
    ...section,
    state: section.state === "open" ? "resolved" : section.state,
    needs: NO_NEEDS,
    resolvedAt: section.resolvedAt ?? at,
    revision: section.revision + 1,
})

/** What a card of a stop asks of the room: `ask` while the founder is asked anything, else `notify`. */
export const stopIntentOf = (section: StopCardSection): "ask" | "notify" =>
    section.state === "open" || needsAnything(section.needs) ? "ask" : "notify"

/**
 * The typed part of a card the old engine posted (no `stop` member): read from its common content, so the web draws every stop card
 * one way. AI-worded → `ai_report`, engine-worded → `ai_error`; open until `resolvedAt` is set; the buttons it carries; no replies kept.
 */
export const legacySectionOf = (base: WorkflowStoppedPayload, headline: string): StopCardSection => {
    const resolvedAt = base.resolvedAt ?? null
    return {
        version: 1,
        stopId: null,
        runId: base.runId,
        stepKey: base.step.key,
        kind: base.by === "engine" ? "ai_error" : "ai_report",
        state: resolvedAt === null ? "open" : "resolved",
        headline,
        needs: resolvedAt === null ? { answer: true, decisions: [...base.decisions], verdicts: [] } : NO_NEEDS,
        replies: [],
        repeats: base.repeats,
        stoppedAt: base.lastAt,
        resolvedAt,
        revision: 0,
    }
}

/** The kind, title and payload of a stored agent message, or null when it is no JSON object. */
const envelopeOf = (agentMessage: string): { kind: unknown; title: unknown; payload: unknown } | null => {
    try {
        const parsed: unknown = JSON.parse(agentMessage)
        if (typeof parsed !== "object" || parsed === null) return null
        return {
            kind: Reflect.get(parsed, "kind"),
            title: Reflect.get(parsed, "title"),
            payload: Reflect.get(parsed, "payload"),
        }
    } catch {
        return null
    }
}

/** The common content and the typed part of a stored stop card, or null when the line is no stop card. */
export const storedStopCardOf = (
    agentMessage: string | null,
): { readonly base: WorkflowStoppedPayload; readonly section: StopCardSection } | null => {
    if (agentMessage === null) return null
    const envelope = envelopeOf(agentMessage)
    if (envelope?.kind !== STOP_CARD_MESSAGE_KIND) return null
    const base = workflowStoppedPayload.safeParse(envelope.payload)
    if (!base.success) return null
    const section = storedSectionOf(envelope.payload)
    return {
        base: base.data,
        section: section ?? legacySectionOf(base.data, typeof envelope.title === "string" ? envelope.title : ""),
    }
}

/** The people whose names the replies of a stored stop card need (a deadline is no person). */
export const stopReplyUsersOf = (agentMessage: string | null): ReadonlyArray<string> => {
    const card = storedStopCardOf(agentMessage)
    if (card === null) return []
    return [...new Set(card.section.replies.map((reply) => reply.by).filter((by) => by !== STOP_CARD_DEADLINE))]
}

/** The stop of a stored line as a screen shows it, or null when the line is no stop card. `nameOf` names a user (empty when unknown). */
export const stopCardViewOf = (
    agentMessage: string | null,
    nameOf: (userId: string) => string,
): StopCardView | null => {
    const card = storedStopCardOf(agentMessage)
    if (card === null) return null
    const { base, section } = card
    return {
        stopId: section.stopId,
        runId: section.runId,
        stepKey: section.stepKey,
        stepTitle: base.step.title,
        workflowTitle: base.workflow.title,
        moduleKey: base.workflow.moduleKey,
        leadId: base.leadId,
        conversationId: base.conversationId,
        kind: section.kind,
        by: base.by,
        state: section.state,
        headline: section.headline,
        message: base.reason,
        question: base.question,
        suggestions: section.state === "open" ? base.suggestions : [],
        facts: base.facts,
        needs: section.needs,
        replies: section.replies.map((reply) => ({
            ...reply,
            byName: reply.by === STOP_CARD_DEADLINE ? "" : nameOf(reply.by),
        })),
        repeats: section.repeats,
        firstAt: base.firstAt,
        stoppedAt: section.stoppedAt,
        resolvedAt: section.resolvedAt,
        revision: section.revision,
    }
}
