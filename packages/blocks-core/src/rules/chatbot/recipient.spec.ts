import { placeholderRecipient, recipientRefused } from "./recipient"

describe("placeholderRecipient", () => {
    it("is true for a Zalo conversation whose sender is no number", () => {
        expect(placeholderRecipient({ channel: "zalo", externalId: "import-12" })).toBe(true)
    })

    it("is false for a Zalo user id, with or without a suffix", () => {
        expect(placeholderRecipient({ channel: "zalo", externalId: "84901234567" })).toBe(false)
        expect(placeholderRecipient({ channel: "zalo", externalId: "84901234567:oa-1" })).toBe(false)
    })

    it("is false for another channel or a conversation without an id", () => {
        expect(placeholderRecipient({ channel: "telegram", externalId: "abc" })).toBe(false)
        expect(placeholderRecipient({ channel: "zalo", externalId: null })).toBe(false)
    })
})

describe("recipientRefused", () => {
    it("is true for the Zalo failures that name the recipient", () => {
        expect(recipientRefused("zalo_recipient")).toBe(true)
        expect(recipientRefused("zalo_unfollowed")).toBe(true)
    })

    it("is false for any other failure or none", () => {
        expect(recipientRefused("zalo_window_expired")).toBe(false)
        expect(recipientRefused(null)).toBe(false)
    })
})
