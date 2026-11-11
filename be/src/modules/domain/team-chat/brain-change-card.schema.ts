import { z } from "zod"
import {
    BRAIN_CHANGE_EVIDENCE_KINDS,
    BRAIN_CHANGE_KINDS,
    BRAIN_CHANGE_MATCHES,
    BRAIN_CHANGE_ORIGINS,
    BRAIN_CHANGE_STATES,
    type BrainChangePayload,
    type BrainChangePayloadGiven,
} from "./brain-change-card.contracts"

/** The most pieces of evidence a card keeps (learning lists the similar answers; a chat card gains one per repeated message). */
export const BRAIN_CHANGE_EVIDENCE_MAX = 20

/** One piece of evidence. */
const evidence = z.object({
    kind: z.enum(BRAIN_CHANGE_EVIDENCE_KINDS),
    quote: z.string().min(1).max(500),
    ref: z.string().min(1).max(300),
    by: z.object({ name: z.string().max(200), memberId: z.string().max(100).nullable() }),
    at: z.string().max(40).nullable(),
})

/** A truth as people write it. */
const factKey = z.object({ subjectLabel: z.string().min(1).max(160), attributeLabel: z.string().min(1).max(120) })

/** The payload of a `brain.change` card as a writer builds it (no revision: the card counts it). */
export const brainChangePayloadGiven = z.object({
    version: z.literal(1),
    changeId: z.string().min(1).max(100),
    origin: z.enum(BRAIN_CHANGE_ORIGINS),
    kind: z.enum(BRAIN_CHANGE_KINDS),
    factKey,
    oldValue: z.string().max(500).nullable(),
    current: z
        .object({
            value: z.string().max(500),
            version: z.number().int().nullable(),
            source: z.string().max(300),
            match: z.enum(BRAIN_CHANGE_MATCHES).optional(),
            factKey: factKey.optional(),
        })
        .nullable(),
    newValue: z.string().max(500),
    unit: z.string().max(20).nullable(),
    validFrom: z.string().max(40).nullable(),
    validTo: z.string().max(40).nullable(),
    reason: z.string().min(1).max(1000),
    evidence: z.array(evidence).min(1).max(BRAIN_CHANGE_EVIDENCE_MAX),
    state: z.enum(BRAIN_CHANGE_STATES),
    decidedBy: z
        .object({ memberId: z.string().max(100), name: z.string().max(200), at: z.string().max(40) })
        .nullable(),
    supersededBy: z.string().max(100).nullable(),
}) satisfies z.ZodType<BrainChangePayloadGiven>

/** The payload as the card stores it: one more member, how many times the card was written. */
export const brainChangePayload = brainChangePayloadGiven.extend({
    revision: z.number().int().min(1),
}) satisfies z.ZodType<BrainChangePayload>
