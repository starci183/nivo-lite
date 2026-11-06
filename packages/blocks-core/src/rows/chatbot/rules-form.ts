import { textOf, valueAt } from "../../slots/paths"
import { CHATBOT_SETTINGS_DEFAULTS, SETTINGS_ISSUE_KEYS, settingsProblemsOf } from "../../rules/chatbot/settings"
import type { ChatbotSettings } from "../../rules/chatbot/settings"

/** The words of the rules form while it is being filled: a timeout not typed yet is null. */
export interface RulesDraft {
    /** The seconds typed; null while the field is empty. */
    readonly openclawTimeoutSec: number | null
    /** The holding message typed. */
    readonly holdingMessage: string
}

/** The draft a saved record starts the form from; a field the record lacks takes the default. */
export const draftOf = (record: unknown): RulesDraft => {
    const saved = valueAt(record, "openclawTimeoutSec")
    const holding = textOf(valueAt(record, "holdingMessage"))
    return {
        openclawTimeoutSec: typeof saved === "number" ? saved : CHATBOT_SETTINGS_DEFAULTS.openclawTimeoutSec,
        holdingMessage: holding === "" ? CHATBOT_SETTINGS_DEFAULTS.holdingMessage : holding,
    }
}

/** What the form found wrong with a draft: the message key of each field that cannot be saved. */
export const rulesErrorsOf = (draft: RulesDraft): Readonly<Partial<Record<keyof ChatbotSettings, string>>> =>
    Object.fromEntries(
        settingsProblemsOf({
            openclawTimeoutSec: draft.openclawTimeoutSec ?? Number.NaN,
            holdingMessage: draft.holdingMessage,
        }).map((problem) => [problem.field, SETTINGS_ISSUE_KEYS[problem.issue]]),
    )

/** The values to save from a draft that has no errors. */
export const valuesOf = (draft: RulesDraft): ChatbotSettings => ({
    openclawTimeoutSec: draft.openclawTimeoutSec ?? CHATBOT_SETTINGS_DEFAULTS.openclawTimeoutSec,
    holdingMessage: draft.holdingMessage.trim(),
})
