import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_BODY } from "../../../bounds"
import { SETTINGS_ISSUE_KEYS, settingsProblemsOf, settingsToStore } from "../../../rules/chatbot/settings"
import { chatbotText } from "../copy"
import { MEMBERS, SETTINGS } from "../ports"
import { refusal } from "./refusal"

/**
 * `chatbot.save-settings`: saves the rules of the Chatbot (how long it waits for the AI's reply, 5 to 120 seconds, and the holding message
 * it sends meanwhile, up to 400 characters). Only owners and managers hold the permission. A setting outside its bounds is refused with the
 * words on its own field; nothing is saved then.
 */
export const SAVE_SETTINGS: ActionDefinition = defineAction({
    id: "chatbot.save-settings",
    permission: "chatbot.manage",
    label: chatbotText("action_save_settings"),
    input: z.object({ openclawTimeoutSec: z.number(), holdingMessage: z.string().max(MAX_BODY) }),
    ports: { settings: SETTINGS, members: MEMBERS },
    transactional: true,
    refreshes: ["chatbot.settings"],
    run: async ({ settings, members }, input, context) => {
        const member = context.memberId === null ? null : await members.get(context.memberId)
        if (member === null) return refusal("forbidden", "reply_forbidden")
        const problems = settingsProblemsOf(input)
        const [first] = problems
        if (first !== undefined) {
            return {
                ok: false,
                reason: "invalid",
                message: { key: SETTINGS_ISSUE_KEYS[first.issue] },
                fields: Object.fromEntries(
                    problems.map((problem) => [problem.field, { key: SETTINGS_ISSUE_KEYS[problem.issue] }]),
                ),
            }
        }
        await settings.save({ ...settingsToStore(input), updatedBy: member.displayName })
        return { ok: true }
    },
})
