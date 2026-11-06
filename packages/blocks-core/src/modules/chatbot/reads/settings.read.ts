import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { CHATBOT_SETTINGS_DEFAULTS } from "../../../rules/chatbot/settings"
import type { SavedSettings } from "../chatbot.types"
import { SETTINGS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `chatbot.settings`: the rules the workspace saved for its Chatbot; the defaults, with nobody as the last editor, before the first save. */
export const SETTINGS_READ: ReadDefinition = defineRead({
    id: "chatbot.settings",
    dataKind: "chatbot-settings",
    shape: "record",
    fields: ["openclawTimeoutSec", "holdingMessage", "updatedBy"],
    paths: {},
    variables,
    permission: "chatbot.view",
    ports: { settings: SETTINGS },
    run: async ({ settings }): Promise<SavedSettings> =>
        (await settings.get()) ?? { ...CHATBOT_SETTINGS_DEFAULTS, updatedBy: "" },
})
