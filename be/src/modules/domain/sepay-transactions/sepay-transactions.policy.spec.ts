import { Test } from "@nestjs/testing"
import { transactionStatus } from "./sepay-transactions.policy"

const SUBJECT = Symbol("sepay-transactions.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { transactionStatus } }],
    }).compile()
    return moduleRef.get<typeof import("./sepay-transactions.policy")>(SUBJECT)
}

describe("sepay transactions policy", () => {
    it("ignores an outgoing transfer whatever the settlement said", async () => {
        const subject = await buildSubject()

        expect(subject.transactionStatus(false, "unmatched")).toBe("ignored")
        expect(subject.transactionStatus(false, "paid")).toBe("ignored")
    })

    it("lists a second transfer for an already-paid order for review as unmatched", async () => {
        const subject = await buildSubject()

        expect(subject.transactionStatus(true, "ignored")).toBe("unmatched")
    })

    it.each(["paid", "underpaid", "expired", "unmatched"] as const)(
        "keeps the %s outcome of an incoming transfer",
        async (outcome) => {
            const subject = await buildSubject()

            expect(subject.transactionStatus(true, outcome)).toBe(outcome)
        },
    )
})
