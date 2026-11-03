import { z } from "zod"

/** The longest key, name or id a row holds. */
const KEY_MAX = 500
/** The longest text a row holds. */
const TEXT_MAX = 4000
/** The longest arguments of a call a row holds. */
const ARGS_MAX = 50_000
/** The most calls one approval holds, as a sequence is bounded. */
const CALLS_MAX = 10

const keyText = z.string().max(KEY_MAX)

const outputCallSchema: z.ZodObject<
    {
        stepKey: z.ZodString
        tool: z.ZodString
        argsJson: z.ZodString
        opKey: z.ZodString
    },
    z.core.$strip
> = z.object({
    /** The step key of this call. */
    stepKey: keyText.min(1),
    /** The full name of the tool. */
    tool: keyText.min(1),
    /** The arguments, as JSON text. */
    argsJson: z.string().max(ARGS_MAX),
    /** The replay key the gateway's receipt is claimed under. */
    opKey: keyText.min(1),
})

/** One call an output runs, from its row alone. */
export type OutputCall = z.infer<typeof outputCallSchema>

/** The conversation and graph nodes persisted with every output. */
export const outputScopeSchema: z.ZodObject<
    {
        conversationId: z.ZodString
        messageId: z.ZodString
        approvedBy: z.ZodNullable<z.ZodString>
        workItemId: z.ZodNullable<z.ZodString>
        planned: z.ZodString
        declined: z.ZodDefault<z.ZodBoolean>
        outputNode: z.ZodString
        approvalNode: z.ZodString
        replyNode: z.ZodString
    },
    z.core.$strip
> = z.object({
    /** The conversation it serves. */
    conversationId: keyText.min(1),
    /** The customer message it answers. */
    messageId: keyText.min(1),
    /** The person who approved it, or null. */
    approvedBy: keyText.nullable(),
    /** The approved work item, or null on a call made inside a turn. */
    workItemId: keyText.nullable(),
    /** What was planned before it ran. */
    planned: z.string().max(TEXT_MAX),
    /** True when a person said no or the wait ran out: nothing ran, and the customer hears the neutral line. */
    declined: z.boolean().default(false),
    /** The output node of the published graph. */
    outputNode: keyText,
    /** The approval node of the published graph. */
    approvalNode: keyText,
    /** The reply node of the published graph. */
    replyNode: keyText,
})

/** Where an output runs: what every step of a sequence shares, and all the final reply step needs. */
export type OutputScope = z.infer<typeof outputScopeSchema>

/** The input of an output step: the call, where it runs, and the calls of the sequence that follow it. */
export const outputInputSchema: z.ZodObject<
    {
        stepKey: z.ZodString
        tool: z.ZodString
        argsJson: z.ZodString
        opKey: z.ZodString
        scope: z.ZodObject<
            {
                conversationId: z.ZodString
                messageId: z.ZodString
                approvedBy: z.ZodNullable<z.ZodString>
                workItemId: z.ZodNullable<z.ZodString>
                planned: z.ZodString
                declined: z.ZodDefault<z.ZodBoolean>
                outputNode: z.ZodString
                approvalNode: z.ZodString
                replyNode: z.ZodString
            },
            z.core.$strip
        >
        rest: z.ZodArray<
            z.ZodObject<
                {
                    stepKey: z.ZodString
                    tool: z.ZodString
                    argsJson: z.ZodString
                    opKey: z.ZodString
                },
                z.core.$strip
            >
        >
    },
    z.core.$strip
> = outputCallSchema.extend({
    scope: outputScopeSchema,
    rest: z.array(outputCallSchema).max(CALLS_MAX),
})

/** The input of an output step. */
export type OutputInput = z.infer<typeof outputInputSchema>

/** One call a person is asked about. */
const heldCallSchema: z.ZodObject<
    {
        tool: z.ZodString
        argsJson: z.ZodString
    },
    z.core.$strip
> = z.object({ tool: keyText.min(1), argsJson: z.string().max(ARGS_MAX) })

/** A call a person is asked about. */
export type HeldCall = z.infer<typeof heldCallSchema>

/** The input of the step a held call waits on: the exact calls, and what they run under once approved. */
export const approvalInputSchema: z.ZodObject<
    {
        workItemId: z.ZodString
        deadlineAt: z.ZodString
        calls: z.ZodArray<
            z.ZodObject<
                {
                    tool: z.ZodString
                    argsJson: z.ZodString
                },
                z.core.$strip
            >
        >
        scope: z.ZodObject<
            {
                conversationId: z.ZodString
                messageId: z.ZodString
                approvedBy: z.ZodNullable<z.ZodString>
                workItemId: z.ZodNullable<z.ZodString>
                planned: z.ZodString
                declined: z.ZodDefault<z.ZodBoolean>
                outputNode: z.ZodString
                approvalNode: z.ZodString
                replyNode: z.ZodString
            },
            z.core.$strip
        >
    },
    z.core.$strip
> = z.object({
    workItemId: keyText.min(1),
    deadlineAt: keyText,
    calls: z.array(heldCallSchema).min(1).max(CALLS_MAX),
    scope: outputScopeSchema,
})

/** The input of an approval step. */
export type ApprovalInput = z.infer<typeof approvalInputSchema>

/** The replay fields and reply a person approved, read from the closed work item's durable proposal. */
export const approvedProposalSchema: z.ZodObject<
    {
        fields: z.ZodObject<
            {
                tool: z.ZodOptional<z.ZodString>
                args_json: z.ZodOptional<z.ZodString>
                steps_json: z.ZodOptional<z.ZodString>
            },
            z.core.$strip
        >
        draft: z.ZodNullable<z.ZodString>
    },
    z.core.$strip
> = z.object({
    fields: z.object({
        tool: keyText.optional(),
        args_json: z.string().max(ARGS_MAX).optional(),
        steps_json: z
            .string()
            .max(ARGS_MAX * CALLS_MAX)
            .optional(),
    }),
    draft: z.string().max(TEXT_MAX).nullable(),
})

/** The approved replay fields after their stored shape is validated. */
export type ApprovedProposal = z.infer<typeof approvedProposalSchema>

/** A persisted, bounded output with its scope, read by the final reply. */
export const outputStepSchema: z.ZodObject<
    {
        tool: z.ZodString
        status: z.ZodEnum<{
            failed: "failed"
            ok: "ok"
            held: "held"
        }>
        code: z.ZodNullable<z.ZodString>
        summary: z.ZodString
        scope: z.ZodObject<
            {
                conversationId: z.ZodString
                messageId: z.ZodString
                approvedBy: z.ZodNullable<z.ZodString>
                workItemId: z.ZodNullable<z.ZodString>
                planned: z.ZodString
                declined: z.ZodDefault<z.ZodBoolean>
                outputNode: z.ZodString
                approvalNode: z.ZodString
                replyNode: z.ZodString
            },
            z.core.$strip
        >
    },
    z.core.$strip
> = z.object({
    tool: keyText,
    status: z.enum(["ok", "failed", "held"]),
    code: keyText.nullable(),
    summary: z.string().max(TEXT_MAX),
    scope: outputScopeSchema,
})

/** A stored output with where it ran, which is all the step after it needs. */
export type StoredOutput = z.infer<typeof outputStepSchema>
