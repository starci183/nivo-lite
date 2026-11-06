import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { channelNameOf } from "../../../rules/chatbot"
import type { ThreadView } from "../chatbot.types"
import { CONVERSATIONS, LEADS } from "../ports"

/** The customer pane of one conversation: who the customer is, where the conversation stands and who holds it. */
export const THREAD: ReadDefinition = defineRead({
    id: "chatbot.thread",
    dataKind: "conversation",
    shape: "record",
    fields: [
        "id",
        "name",
        "channelName",
        "leadId",
        "status",
        "handledBy",
        "stage",
        "need",
        "company",
        "phone",
        "email",
    ],
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, leads: LEADS },
    run: async ({ conversations, leads }, { id }): Promise<ThreadView | null> => {
        const conversation = await conversations.get(id)
        if (conversation === null) return null
        const lead = conversation.leadId === null ? null : await leads.get(conversation.leadId)
        return {
            id: conversation.id,
            name: conversation.name,
            channelName: channelNameOf(conversation.channel),
            leadId: conversation.leadId ?? "",
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
