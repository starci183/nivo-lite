import { z } from "zod"
import type { PayloadMembers, PayloadValue, RaisePayload, UndoPayload } from "./work-item-effects.contracts"

/** The most members a raise payload, or one of its objects and lists, holds. */
const MAX_MEMBERS = 500

/** The longest text of a payload member. */
const MAX_TEXT = 100_000

const payloadValueSchema: z.ZodType<PayloadValue> = z.lazy(() =>
    z.union([
        z.string().max(MAX_TEXT),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(payloadValueSchema).max(MAX_MEMBERS),
        z
            .record(z.string().max(200), payloadValueSchema)
            .refine((entries) => Object.keys(entries).length <= MAX_MEMBERS),
    ]),
)

const payloadMembersSchema: z.ZodType<PayloadMembers> = z
    .record(z.string().max(200), payloadValueSchema)
    .refine((entries) => Object.keys(entries).length <= MAX_MEMBERS)

/** The payload of the `work-item.raise` effect. */
export const raisePayloadSchema: z.ZodType<RaisePayload> = z.object({
    action: z.string().min(1).max(200),
    title: z.string().min(1).max(2000),
    payload: payloadMembersSchema,
    amountVnd: z.number().nonnegative().optional(),
    claimId: z.string().min(1).max(200).optional(),
})

/** The payload of an undo that names one record by its id. */
export const undoPayloadSchema: z.ZodType<UndoPayload> = z.object({ id: z.string().min(1).max(200) })
