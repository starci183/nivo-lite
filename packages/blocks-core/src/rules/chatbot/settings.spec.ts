import {
    CHATBOT_SETTINGS_DEFAULTS,
    HOLDING_MESSAGE_MAX,
    TIMEOUT_MAX_SEC,
    TIMEOUT_MIN_SEC,
    settingsProblemsOf,
    settingsToStore,
} from "./settings"

const GOOD = { openclawTimeoutSec: 25, holdingMessage: "Please wait a moment." }

describe("CHATBOT_SETTINGS_DEFAULTS", () => {
    it("waits 25 seconds, inside the allowed range, with a holding message that fits", () => {
        expect(CHATBOT_SETTINGS_DEFAULTS.openclawTimeoutSec).toBe(25)
        expect(settingsProblemsOf(CHATBOT_SETTINGS_DEFAULTS)).toEqual([])
    })
})

describe("settingsProblemsOf", () => {
    it("accepts the edges of the range and the longest holding message", () => {
        expect(settingsProblemsOf({ ...GOOD, openclawTimeoutSec: TIMEOUT_MIN_SEC })).toEqual([])
        expect(settingsProblemsOf({ ...GOOD, openclawTimeoutSec: TIMEOUT_MAX_SEC })).toEqual([])
        expect(settingsProblemsOf({ ...GOOD, holdingMessage: "a".repeat(HOLDING_MESSAGE_MAX) })).toEqual([])
    })

    it("refuses a timeout outside 5 to 120 seconds", () => {
        const range = [{ field: "openclawTimeoutSec", issue: "timeout_range" }]
        expect(settingsProblemsOf({ ...GOOD, openclawTimeoutSec: TIMEOUT_MIN_SEC - 1 })).toEqual(range)
        expect(settingsProblemsOf({ ...GOOD, openclawTimeoutSec: TIMEOUT_MAX_SEC + 1 })).toEqual(range)
    })

    it("refuses a timeout that is not a whole number of seconds", () => {
        expect(settingsProblemsOf({ ...GOOD, openclawTimeoutSec: 12.5 })).toEqual([
            { field: "openclawTimeoutSec", issue: "timeout_whole" },
        ])
    })

    it("refuses a holding message that is empty or over 400 characters, counting without the blanks around it", () => {
        expect(settingsProblemsOf({ ...GOOD, holdingMessage: "   " })).toEqual([
            { field: "holdingMessage", issue: "holding_empty" },
        ])
        expect(settingsProblemsOf({ ...GOOD, holdingMessage: "a".repeat(HOLDING_MESSAGE_MAX + 1) })).toEqual([
            { field: "holdingMessage", issue: "holding_too_long" },
        ])
        expect(settingsProblemsOf({ ...GOOD, holdingMessage: ` ${"a".repeat(HOLDING_MESSAGE_MAX)} ` })).toEqual([])
    })

    it("reports both settings when both are wrong", () => {
        expect(settingsProblemsOf({ openclawTimeoutSec: 0, holdingMessage: "" })).toHaveLength(2)
    })
})

describe("settingsToStore", () => {
    it("trims the holding message and keeps the timeout", () => {
        expect(settingsToStore({ openclawTimeoutSec: 30, holdingMessage: "  Please wait  " })).toEqual({
            openclawTimeoutSec: 30,
            holdingMessage: "Please wait",
        })
    })
})
