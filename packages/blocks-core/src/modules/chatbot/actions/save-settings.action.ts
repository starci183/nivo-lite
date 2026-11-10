import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_BODY } from "../../../bounds"
import { CHATBOT_SETTINGS_SCOPE } from "../../../entities/chat/settings.entity"
import { SETTINGS_ISSUE_KEYS, settingsProblemsOf, settingsToStore } from "../../../rules/chatbot/settings"
import { chatbotText } from "../copy"
import { membersPort } from "../../platform/ports"
import { SETTINGS } from "../ports"
import { refusal, writeRefusal } from "./refusal"

/**
 * `chatbot.save-settings`: saves the rules of the Chatbot (the holding message it sends while the AI works, up to 400 characters) as
 * the one `chat.settings` record of the workspace. Only owners and managers hold the
 * permission. A setting outside its bounds is refused with the words on its own field; nothing is saved then.
 */
export const SAVE_SETTINGS: ActionDefinition = defineAction({
    id: "chatbot.save-settings",
    permission: "chatbot.manage",
    label: chatbotText("action_save_settings"),
    input: z.object({ holdingMessage: z.string().max(MAX_BODY) }),
    ports: { settings: SETTINGS, members: membersPort },
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
        const saved = await settings.upsert("scope_key", {
            scope: CHATBOT_SETTINGS_SCOPE,
            ...settingsToStore(input),
            updatedBy: member.displayName,
        })
        return saved.ok ? { ok: true } : writeRefusal(saved)
    },
})
