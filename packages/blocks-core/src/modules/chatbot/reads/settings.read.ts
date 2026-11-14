import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { CHATBOT_SETTINGS_SCOPE } from "../../../entities/chat/settings.entity"
import { CHATBOT_SETTINGS_DEFAULTS } from "../../../rules/chatbot/settings"
import type { ChatbotSettings } from "../../../rules/chatbot/settings"
import { SETTINGS_FIELDS, settingsOf } from "../chatbot-records"
import { SETTINGS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `blocks-core.chatbot.api.settings.get`: the rules the workspace saved for its Chatbot, with who saved them last; the defaults, with nobody, before the first save. */
export const SETTINGS_READ: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.settings.get",
    dataKind: "chatbot-settings",
    shape: "record",
    fields: ["holdingMessage", "updatedBy"],
    paths: {},
    variables,
    permission: "chatbot.view",
    ports: { settings: SETTINGS },
    run: async ({ settings }): Promise<ChatbotSettings & { readonly updatedBy: string }> => {
        const page = await settings.list({
            select: SETTINGS_FIELDS,
            where: q.eq("scope", CHATBOT_SETTINGS_SCOPE),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        const [found] = page.rows
        return (found === undefined ? null : settingsOf(found.row)) ?? { ...CHATBOT_SETTINGS_DEFAULTS, updatedBy: "" }
    },
})
