import { CHATBOT_SETTINGS_DEFAULTS } from "../../rules/chatbot/settings"
import { draftOf, rulesErrorsOf, valuesOf } from "./rules-form"

describe("draftOf", () => {
    it("starts from the saved settings", () => {
        expect(draftOf({ holdingMessage: "Please wait" })).toEqual({ holdingMessage: "Please wait" })
    })

    it("takes the defaults for what the record lacks", () => {
        expect(draftOf({})).toEqual(CHATBOT_SETTINGS_DEFAULTS)
        expect(draftOf(null)).toEqual(CHATBOT_SETTINGS_DEFAULTS)
    })
})

describe("rulesErrorsOf", () => {
    it("finds nothing wrong with good settings", () => {
        expect(rulesErrorsOf({ holdingMessage: "Please wait" })).toEqual({})
    })

    it("names the message of the refused field", () => {
        expect(rulesErrorsOf({ holdingMessage: "" })).toEqual({ holdingMessage: "rules_error_holding_empty" })
        expect(rulesErrorsOf({ holdingMessage: "a".repeat(401) })).toEqual({
            holdingMessage: "rules_error_holding_too_long",
        })
    })
})

describe("valuesOf", () => {
    it("trims the message", () => {
        expect(valuesOf({ holdingMessage: " Please wait " })).toEqual({ holdingMessage: "Please wait" })
    })
})
