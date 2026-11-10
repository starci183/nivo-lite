import defaults from "./settings.defaults.json"

/** The longest holding message, in characters. */
export const HOLDING_MESSAGE_MAX = 400

/** What the Chatbot says by default while the AI is still working. */
export const CHATBOT_SETTINGS_DEFAULTS: ChatbotSettings = defaults

/** The rules of the Chatbot an owner or a manager may change. */
export interface ChatbotSettings {
    /** What the customer reads while the AI is still working. */
    readonly holdingMessage: string
}

/** Which setting broke which bound. */
export type SettingsIssue = "holding_empty" | "holding_too_long"

/** One refused setting: the field and why. */
export interface SettingsProblem {
    /** The setting. */
    readonly field: keyof ChatbotSettings
    /** Why it was refused. */
    readonly issue: SettingsIssue
}

/** The message key that words each refusal, in the module's catalogue. */
export const SETTINGS_ISSUE_KEYS: Readonly<Record<SettingsIssue, string>> = {
    holding_empty: "rules_error_holding_empty",
    holding_too_long: "rules_error_holding_too_long",
}

/** What is wrong with the settings; nothing when they may be saved. */
export const settingsProblemsOf = (given: ChatbotSettings): ReadonlyArray<SettingsProblem> => {
    const problems: Array<SettingsProblem> = []
    const holding = given.holdingMessage.trim()
    if (holding.length === 0) problems.push({ field: "holdingMessage", issue: "holding_empty" })
    else if (holding.length > HOLDING_MESSAGE_MAX) problems.push({ field: "holdingMessage", issue: "holding_too_long" })
    return problems
}

/** The settings to store: the holding message without the blanks around it. */
export const settingsToStore = (given: ChatbotSettings): ChatbotSettings => ({
    holdingMessage: given.holdingMessage.trim(),
})
