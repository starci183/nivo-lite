import { CHATBOT_SETTINGS_DEFAULTS, HOLDING_MESSAGE_MAX, settingsProblemsOf, settingsToStore } from "./settings"

const GOOD = { holdingMessage: "Please wait a moment." }

describe("CHATBOT_SETTINGS_DEFAULTS", () => {
    it("holds a holding message that fits", () => {
        const anyText: unknown = expect.any(String)
        expect(CHATBOT_SETTINGS_DEFAULTS).toEqual({ holdingMessage: anyText })
        expect(settingsProblemsOf(CHATBOT_SETTINGS_DEFAULTS)).toEqual([])
    })
})

describe("settingsProblemsOf", () => {
    it("accepts the longest holding message", () => {
        expect(settingsProblemsOf(GOOD)).toEqual([])
        expect(settingsProblemsOf({ holdingMessage: "a".repeat(HOLDING_MESSAGE_MAX) })).toEqual([])
    })

    it("refuses a holding message that is empty or over 400 characters, counting without the blanks around it", () => {
        expect(settingsProblemsOf({ holdingMessage: "   " })).toEqual([
            { field: "holdingMessage", issue: "holding_empty" },
        ])
        expect(settingsProblemsOf({ holdingMessage: "a".repeat(HOLDING_MESSAGE_MAX + 1) })).toEqual([
            { field: "holdingMessage", issue: "holding_too_long" },
        ])
        expect(settingsProblemsOf({ holdingMessage: ` ${"a".repeat(HOLDING_MESSAGE_MAX)} ` })).toEqual([])
    })
})

describe("settingsToStore", () => {
    it("trims the holding message", () => {
        expect(settingsToStore({ holdingMessage: "  Please wait  " })).toEqual({ holdingMessage: "Please wait" })
    })
})
