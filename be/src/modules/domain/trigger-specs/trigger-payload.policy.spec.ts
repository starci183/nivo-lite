import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { adapterOf, declaredPayloadOf, suppliesOfVerb } from "./trigger-specs.policy"

// The DECLARED payload of a trigger (generic, no money logic): a verb may declare members the engine fills from the stored row its
// event's id names, field by field, as data (`TriggerSpec.reads`). The bank credit declares the row's amount, content, time, account
// and bank reference, which every bank feed's `<provider>.transaction` row holds under the same field names.
describe("the declared payload of payment.credit.received", () => {
    // One trigger pipeline: the scope is the generic `eventId` / `accountId` / `data` / `locale`, and the credit's facts are members of
    // its `data` (the source's translate puts them there; the flow fills nothing at the top of a pipeline event). The declared members
    // therefore join `data.members` beside the id, and none of them is a top-level member (E-RED: the lookup listed them at the top,
    // where no run ever finds them).
    it("every bank feed supplies the declared members in its data, beside the id", () => {
        for (const provider of [PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos]) {
            const adapter = adapterOf(TRIGGER.paymentCreditReceived, provider)
            const supplied = adapter === undefined ? [] : suppliesOfVerb(TRIGGER.paymentCreditReceived, adapter)
            expect(supplied.map((one) => one.name)).toEqual(["eventId", "accountId", "data", "locale"])
            const data = supplied.find((one) => one.name === "data")?.members?.map((one) => one.name) ?? []
            expect(data).toEqual(expect.arrayContaining(["transactionId", "direction", "amountVnd", "content", "at", "account", "bankRef"]))
        }
    })

    it("fills each declared member from the row as stored, leaving out what the row does not hold", () => {
        expect(
            declaredPayloadOf(TRIGGER.paymentCreditReceived, {
                transactionId: "t-1",
                amount: 150000,
                direction: "credit",
                content: "CK DH A12",
                account: "0123",
                bankRef: "FT26",
                at: "2026-11-13T02:00:00.000Z",
                payer: "NGUYEN VAN A",
            }),
        ).toEqual({ amountVnd: 150000, content: "CK DH A12", at: "2026-11-13T02:00:00.000Z", account: "0123", bankRef: "FT26" })
        expect(declaredPayloadOf(TRIGGER.paymentCreditReceived, { amount: 5, content: "x" })).toEqual({ amountVnd: 5, content: "x" })
    })

    it("a verb that declares no read fills nothing", () => {
        expect(declaredPayloadOf(TRIGGER.clockTick, { amount: 5 })).toEqual({})
    })
})
