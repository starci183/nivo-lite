import { textOf, valueAt } from "../../slots/paths"
import { CHATBOT_SETTINGS_DEFAULTS, SETTINGS_ISSUE_KEYS, settingsProblemsOf } from "../../rules/chatbot/settings"
import type { ChatbotSettings } from "../../rules/chatbot/settings"

/** The words of the rules form while it is being filled. */
export interface RulesDraft {
    /** The holding message typed. */
    readonly holdingMessage: string
}

/** The draft a saved record starts the form from; a field the record lacks takes the default. */
export const draftOf = (record: unknown): RulesDraft => {
    const holding = textOf(valueAt(record, "holdingMessage"))
    return {
        holdingMessage: holding === "" ? CHATBOT_SETTINGS_DEFAULTS.holdingMessage : holding,
    }
}

/** What the form found wrong with a draft: the message key of each field that cannot be saved. */
export const rulesErrorsOf = (draft: RulesDraft): Readonly<Partial<Record<keyof ChatbotSettings, string>>> =>
    Object.fromEntries(
        settingsProblemsOf({ holdingMessage: draft.holdingMessage }).map((problem) => [problem.field, SETTINGS_ISSUE_KEYS[problem.issue]]),
    )

/** The values to save from a draft that has no errors. */
export const valuesOf = (draft: RulesDraft): ChatbotSettings => ({
    holdingMessage: draft.holdingMessage.trim(),
})
