import { z } from "zod"
import type { ZodType } from "zod"

/** Any of the task schemas, for the call that hands one to the chain. */
export type TaskSchema = ZodType

/**
 * The shapes the JSON tasks ask the model for, as LangChain structured output. They are as lenient as the mappers behind them: every
 * member may be missing or null and unknown members pass through, so an answer that does not fit is parsed loosely and the mappers
 * give their fallbacks, exactly as before. The schema names the members; it never rejects a usable answer.
 */
const text = z.string().max(4000).nullish()
const count = z.number().nullish()

/** A responsibility proposed for a lead. */
export const RESPONSIBILITY_SCHEMA: z.ZodObject<
    {
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>
        owner_kind: z.ZodOptional<z.ZodNullable<z.ZodString>>
        owner_handle: z.ZodOptional<z.ZodNullable<z.ZodString>>
        next_action: z.ZodOptional<z.ZodNullable<z.ZodString>>
        due_in_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
        rationale: z.ZodOptional<z.ZodNullable<z.ZodString>>
    },
    z.core.$loose
> = z.looseObject({
    title: text,
    owner_kind: text,
    owner_handle: text,
    next_action: text,
    due_in_days: count,
    rationale: text,
})

/** An agent definition designed from a description. */
export const DESIGN_SCHEMA: z.ZodObject<
    {
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>
        handle: z.ZodOptional<z.ZodNullable<z.ZodString>>
        role: z.ZodOptional<z.ZodNullable<z.ZodString>>
        instructions: z.ZodOptional<z.ZodNullable<z.ZodString>>
    },
    z.core.$loose
> = z.looseObject({ name: text, handle: text, role: text, instructions: text })

/** The classification of a lead. */
export const CLASSIFICATION_SCHEMA: z.ZodObject<
    {
        stage: z.ZodOptional<z.ZodNullable<z.ZodString>>
        confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
        next_action: z.ZodOptional<z.ZodNullable<z.ZodString>>
        missing: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>
        context: z.ZodOptional<z.ZodNullable<z.ZodString>>
    },
    z.core.$loose
> = z.looseObject({
    stage: text,
    confidence: count,
    next_action: text,
    missing: z.array(z.string().max(1000)).max(100).nullish(),
    context: text,
})

/** An order read from free text. */
export const ORDER_SCHEMA: z.ZodObject<
    {
        items: z.ZodOptional<z.ZodNullable<z.ZodString>>
        amount_vnd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
        confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    },
    z.core.$loose
> = z.looseObject({ items: text, amount_vnd: count, confidence: count })

/** The authority the owner granted in chat. */
export const AUTHORITY_SCHEMA: z.ZodObject<
    {
        goals: z.ZodOptional<z.ZodNullable<z.ZodObject<{}, z.core.$loose>>>
        policies_add: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>
        reply_style: z.ZodOptional<z.ZodNullable<z.ZodString>>
        brand_voice: z.ZodOptional<z.ZodNullable<z.ZodString>>
        limits_note_add: z.ZodOptional<z.ZodNullable<z.ZodString>>
        rules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{}, z.core.$loose>>>>
        understood: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>
    },
    z.core.$loose
> = z.looseObject({
    goals: z.looseObject({}).nullish(),
    policies_add: z.array(z.string().max(1000)).max(100).nullish(),
    reply_style: text,
    brand_voice: text,
    limits_note_add: text,
    rules: z.array(z.looseObject({})).max(100).nullish(),
    understood: z.boolean().nullish(),
})

/** The one command an Office message proposes. */
export const COMMAND_SCHEMA: z.ZodObject<
    {
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>
        command: z.ZodOptional<z.ZodNullable<z.ZodString>>
        subject_id: z.ZodOptional<z.ZodNullable<z.ZodString>>
        lead_id: z.ZodOptional<z.ZodNullable<z.ZodString>>
        fields: z.ZodOptional<z.ZodNullable<z.ZodObject<{}, z.core.$loose>>>
    },
    z.core.$loose
> = z.looseObject({
    intent: text,
    command: text,
    subject_id: text,
    lead_id: text,
    fields: z.looseObject({}).nullish(),
})

/** The reading of a prospect's turn: the lead flow validates every member itself. */
export const LEAD_TURN_SCHEMA: z.ZodObject<{}, z.core.$loose> = z.looseObject({})
