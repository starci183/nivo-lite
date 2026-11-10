import { logoOf } from "./provider-logos"

describe("the logo of a provider", () => {
    it("is the path the app serves for a provider that has one", () => {
        expect(logoOf("sepay")).toBe("/logos/providers/sepay.png")
        expect(logoOf("imap")).toBe("/logos/connectors/imap.svg")
    })

    it("is nothing for an unknown provider or none", () => {
        expect(logoOf("nobody")).toBeUndefined()
        expect(logoOf(undefined)).toBeUndefined()
    })
})
