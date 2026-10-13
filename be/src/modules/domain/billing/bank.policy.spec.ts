import { simulatedBankEventId, simulatedCreditOf } from "./bank.policy"

describe("bank policy", () => {
    it("prefixes the event id of the simulated bank", () => {
        expect(simulatedBankEventId("tx-1")).toBe("vietcombank:tx-1")
    })

    describe("simulatedCreditOf", () => {
        it("reads the credit with its text trimmed", () => {
            expect(
                simulatedCreditOf({
                    amount_vnd: 150000,
                    content: " NIVO8F3K2 ",
                    sender_name: " Anh Minh ",
                    event_id: " tx-1 ",
                }),
            ).toEqual({ amount: 150000, content: "NIVO8F3K2", sender: "Anh Minh", eventId: "tx-1" })
        })

        it("accepts a numeric amount text and a numeric event id, and defaults the content and the payer", () => {
            expect(simulatedCreditOf({ amount_vnd: "2500", event_id: 77, sender_name: "  " })).toEqual({
                amount: 2500,
                content: "",
                sender: null,
                eventId: "77",
            })
        })

        it("refuses an amount that is not above 0 and a missing or unusable event id", () => {
            expect(simulatedCreditOf({ amount_vnd: 0, event_id: "a" })).toBeNull()
            expect(simulatedCreditOf({ amount_vnd: -5, event_id: "a" })).toBeNull()
            expect(simulatedCreditOf({ amount_vnd: "abc", event_id: "a" })).toBeNull()
            expect(simulatedCreditOf({ amount_vnd: 10 })).toBeNull()
            expect(simulatedCreditOf({ amount_vnd: 10, event_id: "  " })).toBeNull()
            expect(simulatedCreditOf({ amount_vnd: 10, event_id: {} })).toBeNull()
        })
    })
})
