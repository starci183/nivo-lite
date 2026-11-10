import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** An id the door fixes from the run token; a caller that names one names its own or is refused. */
const lockedId = (): z.ZodOptional<z.ZodString> => z.string().min(1).max(200).optional()

/** A list read as the gateway validates it: the most rows, and the ids the door filled. */
type LockedList = z.ZodObject<
    {
        limit: z.ZodOptional<z.ZodNumber>
        conversationId: z.ZodOptional<z.ZodString>
        leadId: z.ZodOptional<z.ZodString>
    },
    z.core.$strict
>

/** A list read as the model calls it: the most rows, nothing else. */
type AskedList = z.ZodObject<{ limit: z.ZodOptional<z.ZodNumber> }, z.core.$strict>

const askedListOf = (max: number): AskedList => z.object({ limit: z.number().int().min(1).max(max).optional() }).strict()

const lockedListOf = (max: number): LockedList =>
    z
        .object({
            limit: z.number().int().min(1).max(max).optional(),
            conversationId: lockedId(),
            leadId: lockedId(),
        })
        .strict()

/** The validator of `conversation.message.list` on the gateway. */
export const CONVERSATION_MESSAGE_LIST_SCHEMA: LockedList = lockedListOf(30)

/** The validator of `lead.order.list` on the gateway. */
export const LEAD_ORDER_LIST_SCHEMA: LockedList = lockedListOf(10)

/** The validator of `lead.note.list` on the gateway. */
export const LEAD_NOTE_LIST_SCHEMA: LockedList = lockedListOf(20)

/** The validator of `lead.profile.get` on the gateway: only the ids the door filled. */
export const LEAD_PROFILE_GET_SCHEMA: z.ZodObject<
    { conversationId: z.ZodOptional<z.ZodString>; leadId: z.ZodOptional<z.ZodString> },
    z.core.$strict
> = z.object({ conversationId: lockedId(), leadId: lockedId() }).strict()

/** The arguments of a locked list read as its validator reads them. */
export type LockedListInput = z.output<LockedList>

/** The schemas the manifest advertises: what the model may say, never the ids the door fills. */
export const CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(askedListOf(30), { io: "input" })
export const LEAD_ORDER_LIST_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(askedListOf(10), { io: "input" })
export const LEAD_NOTE_LIST_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(askedListOf(20), { io: "input" })
export const LEAD_PROFILE_GET_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(z.object({}).strict(), { io: "input" })
