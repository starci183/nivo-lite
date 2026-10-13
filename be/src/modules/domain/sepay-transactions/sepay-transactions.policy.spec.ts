import { transactionStatus } from "./sepay-transactions.policy"

describe("sepay transactions policy", () => {
    it("ignores an outgoing transfer whatever the settlement said", () => {
        expect(transactionStatus(false, "unmatched")).toBe("ignored")
        expect(transactionStatus(false, "paid")).toBe("ignored")
    })

    it("lists a second transfer for an already-paid order for review as unmatched", () => {
        expect(transactionStatus(true, "ignored")).toBe("unmatched")
    })

    it.each(["paid", "underpaid", "expired", "unmatched"] as const)(
        "keeps the %s outcome of an incoming transfer",
        (outcome) => {
            expect(transactionStatus(true, outcome)).toBe(outcome)
        },
    )
})
