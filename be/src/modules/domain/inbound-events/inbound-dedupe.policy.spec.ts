import { bankDedupeKey } from "./inbound-dedupe.policy"

describe("inbound dedupe policy", () => {
    it("keys a bank payment by its trimmed event id", () => {
        expect(bankDedupeKey(" casso:42 ")).toBe("bank:payment:casso:42")
    })
})
