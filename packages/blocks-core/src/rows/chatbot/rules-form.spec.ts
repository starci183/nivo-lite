import { CHATBOT_SETTINGS_DEFAULTS } from "../../rules/chatbot/settings"
import { draftOf, rulesErrorsOf, valuesOf } from "./rules-form"

describe("draftOf", () => {
    it("starts from the saved settings", () => {
        expect(draftOf({ openclawTimeoutSec: 40, holdingMessage: "Please wait" })).toEqual({
            openclawTimeoutSec: 40,
            holdingMessage: "Please wait",
        })
    })

    it("takes the defaults for what the record lacks", () => {
        expect(draftOf({})).toEqual(CHATBOT_SETTINGS_DEFAULTS)
        expect(draftOf(null).openclawTimeoutSec).toBe(25)
    })
})

describe("rulesErrorsOf", () => {
    it("finds nothing wrong with good settings", () => {
        expect(rulesErrorsOf({ openclawTimeoutSec: 25, holdingMessage: "Please wait" })).toEqual({})
    })

    it("names the message of each refused field", () => {
        expect(rulesErrorsOf({ openclawTimeoutSec: 3, holdingMessage: "" })).toEqual({
            openclawTimeoutSec: "rules_error_timeout_range",
            holdingMessage: "rules_error_holding_empty",
        })
        expect(rulesErrorsOf({ openclawTimeoutSec: 1.5, holdingMessage: "a".repeat(401) })).toEqual({
            openclawTimeoutSec: "rules_error_timeout_whole",
            holdingMessage: "rules_error_holding_too_long",
        })
    })

    it("refuses a timeout that was not typed", () => {
        expect(rulesErrorsOf({ openclawTimeoutSec: null, holdingMessage: "Wait" })).toEqual({
            openclawTimeoutSec: "rules_error_timeout_whole",
        })
    })
})

describe("valuesOf", () => {
    it("trims the message and keeps the seconds", () => {
        expect(valuesOf({ openclawTimeoutSec: 30, holdingMessage: " Please wait " })).toEqual({
            openclawTimeoutSec: 30,
            holdingMessage: "Please wait",
        })
    })

    it("falls back to the default seconds for a timeout that was not typed", () => {
        expect(valuesOf({ openclawTimeoutSec: null, holdingMessage: "Wait" }).openclawTimeoutSec).toBe(25)
    })
})
