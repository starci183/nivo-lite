import { z } from "zod"
import {
    STOP_CARD_DECISIONS,
    STOP_CARD_KINDS,
    STOP_CARD_REPLY_KINDS,
    STOP_CARD_STATES,
    STOP_CARD_VERDICTS,
    type StopCardSection,
    type StopCardSectionGiven,
} from "./stop-card.contracts"

/** The typed part as the engine hands it (no revision: the team chat counts it). The stop record keeps at most 50 answers. */
export const stopCardSectionGiven = z.object({
    version: z.literal(1),
    stopId: z.string().max(100).nullable(),
    runId: z.string().max(100),
    stepKey: z.string().max(200),
    kind: z.enum(STOP_CARD_KINDS),
    state: z.enum(STOP_CARD_STATES),
    headline: z.string().max(300),
    needs: z.object({
        answer: z.boolean(),
        decisions: z.array(z.enum(STOP_CARD_DECISIONS)).max(STOP_CARD_DECISIONS.length),
        verdicts: z.array(z.enum(STOP_CARD_VERDICTS)).max(STOP_CARD_VERDICTS.length),
    }),
    replies: z
        .array(
            z.object({
                kind: z.enum(STOP_CARD_REPLY_KINDS),
                text: z.string().max(4000).nullable(),
                by: z.string().max(100),
                at: z.string().max(40),
            }),
        )
        .max(50),
    repeats: z.number().int().min(1),
    stoppedAt: z.string().max(40),
    resolvedAt: z.string().max(40).nullable(),
    approval: z
        .object({
            workItemId: z.string().max(100),
            tool: z.string().max(300),
            account: z.string().max(300),
            ability: z.string().max(200),
            args: z.array(z.object({ name: z.string().max(100), value: z.string().max(1000) })).max(20),
        })
        .nullable()
        .optional(),
}) satisfies z.ZodType<StopCardSectionGiven>

/** The typed part as the card stores it: one more member, how many times the card was written. */
export const stopCardSection = stopCardSectionGiven.extend({
    revision: z.number().int().min(0),
}) satisfies z.ZodType<StopCardSection>
