import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { membersPort, routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { channelNameOf } from "../../../rules/chatbot"
import { CONVERSATION_FIELDS, threadRowOf } from "../chatbot-records"
import type { ThreadView } from "../chatbot.types"
import { CONVERSATIONS } from "../ports"
import { shownHolderOf } from "./route-holder"

/**
 * The customer pane of one conversation: who the customer is, where the conversation stands and who holds it. The holder is the ENGINE's
 * staff hold of the chat's route (`platform.route-holds`, ruling R43), named from the members: the chat stores none.
 */
export const THREAD: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.chat.get",
    dataKind: "conversation",
    shape: "record",
    fields: ["id", "name", "channelName", "avatarUrl", "contactId", "routeId", "status", "handledBy"],
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, holds: routeHoldsPort, members: membersPort },
    run: async ({ conversations, holds, members }, { id }): Promise<ThreadView | null> => {
        const page = await conversations.list({
            select: CONVERSATION_FIELDS,
            where: q.eq("id", id),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        const [found] = page.rows
        const conversation = found === undefined ? null : threadRowOf(found.row)
        if (found === undefined || conversation === null) return null
        const shown = await shownHolderOf(holds, members, conversation)
        return {
            id: conversation.id,
            name: conversation.name,
            channelName: channelNameOf(conversation.channel),
            avatarUrl: conversation.avatarUrl ?? "",
            contactId: conversation.contactId ?? "",
            routeId: conversation.routeId ?? "",
            status: shown.status,
            handledBy: shown.handledBy,
        }
    },
})
