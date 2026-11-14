import { z } from "zod"
import { lockedArgumentsShape } from "@modules/domain/context-sources"
import type { ToolJson } from "@modules/domain/tools"

/** The most lines one call answers, and what it answers when `limit` is left out. */
export const THREAD_LIST_MAX = 50
export const THREAD_LIST_DEFAULT = 20

/** The longest words of one line the answer carries; a longer one is cut. */
export const THREAD_TEXT_MAX = 1000

/** What the model may say: a bounded limit and an optional lower limit in time. */
const askedMembers = {
    limit: z.number().int().min(1).max(THREAD_LIST_MAX).optional(),
    since: z.iso.datetime().optional(),
}

/**
 * `nivo.tool.conversation.message.list` on the gateway: a bounded limit, an optional lower limit in time (`since`, ISO: e.g. the start of a
 * chatbot's current visit; absent: the whole route), and the subject members the door fills into every locked read (`lockedArgumentsShape`,
 * ruling R51 item 1): the route (`conversationId`, the only one this read is scoped by: no other route is read), the contact and the lead
 * (unread here).
 */
export const CONVERSATION_MESSAGE_LIST_SCHEMA = z.object({ ...askedMembers, ...lockedArgumentsShape() }).strict()

/** The input schema the connector advertises: what the model may say, never the ids the door fills. */
export const CONVERSATION_MESSAGE_LIST_INPUT_SCHEMA: ToolJson = z.toJSONSchema(z.object(askedMembers).strict(), { io: "input" })
