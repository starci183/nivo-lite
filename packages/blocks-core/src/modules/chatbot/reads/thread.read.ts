import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { channelNameOf } from "../../../rules/chatbot"
import { CONVERSATION_FIELDS, LEAD_FIELDS, leadFactsOf, threadRowOf } from "../chatbot-records"
import type { ThreadView } from "../chatbot.types"
import { CONVERSATIONS } from "../ports"

/** The customer pane of one conversation: who the customer is, where the conversation stands and who holds it. */
export const THREAD: ReadDefinition = defineRead({
    id: "chatbot.thread",
    dataKind: "conversation",
    shape: "record",
    fields: ["id", "name", "channelName", "status", "handledBy", "stage", "need", "company", "phone", "email"],
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS },
    run: async ({ conversations }, { id }): Promise<ThreadView | null> => {
        const page = await conversations.list({
            select: CONVERSATION_FIELDS,
            join: { lead: LEAD_FIELDS },
            where: q.eq("id", id),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        const [found] = page.rows
        const conversation = found === undefined ? null : threadRowOf(found.row)
        if (found === undefined || conversation === null) return null
        const lead = leadFactsOf(found.joined["lead"] ?? null)
        return {
            id: conversation.id,
            name: conversation.name,
            channelName: channelNameOf(conversation.channel),
            status: conversation.status,
            handledBy: conversation.handledBy ?? "",
            stage: lead?.stage ?? "",
            need: lead?.need ?? "",
            company: lead?.company ?? "",
            phone: lead?.phone ?? "",
            email: lead?.email ?? "",
        }
    },
})
