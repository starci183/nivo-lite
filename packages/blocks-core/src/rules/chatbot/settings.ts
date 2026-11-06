import defaults from "./settings.defaults.json"

/** The fastest reply timeout the owner may set, in seconds. */
export const TIMEOUT_MIN_SEC = 5

/** The slowest reply timeout the owner may set, in seconds. */
export const TIMEOUT_MAX_SEC = 120

/** The longest holding message, in characters. */
export const HOLDING_MESSAGE_MAX = 400

/** What the Chatbot does by default: waits 25 seconds for the AI, then sends the holding message. */
export const CHATBOT_SETTINGS_DEFAULTS: ChatbotSettings = defaults

/** The rules of the Chatbot an owner or a manager may change. */
export interface ChatbotSettings {
    /** How long the Chatbot waits for the AI's reply before it sends the holding message, in seconds. */
    readonly openclawTimeoutSec: number
    /** What the customer reads while the AI is still working. */
    readonly holdingMessage: string
}

/** Which setting broke which bound. */
export type SettingsIssue = "timeout_range" | "timeout_whole" | "holding_empty" | "holding_too_long"

/** One refused setting: the field and why. */
export interface SettingsProblem {
    /** The setting. */
    readonly field: keyof ChatbotSettings
    /** Why it was refused. */
    readonly issue: SettingsIssue
}

/** The message key that words each refusal, in the module's catalogue. */
export const SETTINGS_ISSUE_KEYS: Readonly<Record<SettingsIssue, string>> = {
    timeout_range: "rules_error_timeout_range",
    timeout_whole: "rules_error_timeout_whole",
    holding_empty: "rules_error_holding_empty",
    holding_too_long: "rules_error_holding_too_long",
}

/** What is wrong with the settings; nothing when they may be saved. */
export const settingsProblemsOf = (given: ChatbotSettings): ReadonlyArray<SettingsProblem> => {
    const problems: Array<SettingsProblem> = []
    if (!Number.isInteger(given.openclawTimeoutSec)) {
        problems.push({ field: "openclawTimeoutSec", issue: "timeout_whole" })
    } else if (given.openclawTimeoutSec < TIMEOUT_MIN_SEC || given.openclawTimeoutSec > TIMEOUT_MAX_SEC) {
        problems.push({ field: "openclawTimeoutSec", issue: "timeout_range" })
    }
    const holding = given.holdingMessage.trim()
    if (holding.length === 0) problems.push({ field: "holdingMessage", issue: "holding_empty" })
    else if (holding.length > HOLDING_MESSAGE_MAX) problems.push({ field: "holdingMessage", issue: "holding_too_long" })
    return problems
}

/** The settings to store: the holding message without the blanks around it. */
export const settingsToStore = (given: ChatbotSettings): ChatbotSettings => ({
    openclawTimeoutSec: given.openclawTimeoutSec,
    holdingMessage: given.holdingMessage.trim(),
})
