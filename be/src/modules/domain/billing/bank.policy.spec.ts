import { Test } from "@nestjs/testing"

import {
    simulatedBankEventId as realSimulatedBankEventId,
    simulatedCreditOf as realSimulatedCreditOf,
} from "./bank.policy"

const SUBJECT = Symbol("bank.policy")

type Subject = {
    simulatedBankEventId: typeof realSimulatedBankEventId
    simulatedCreditOf: typeof realSimulatedCreditOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    simulatedBankEventId: realSimulatedBankEventId,
                    simulatedCreditOf: realSimulatedCreditOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("bank policy", () => {
    it("prefixes the event id of the simulated bank", async () => {
        const { subject } = await buildSubject()

        expect(subject.simulatedBankEventId("tx-1")).toBe("vietcombank:tx-1")
    })

    describe("simulatedCreditOf", () => {
        it("reads the credit with its text trimmed", async () => {
            const { subject } = await buildSubject()

            expect(
                subject.simulatedCreditOf({
                    amount_vnd: 150000,
                    content: " NIVO8F3K2 ",
                    sender_name: " Anh Minh ",
                    event_id: " tx-1 ",
                }),
            ).toEqual({ amount: 150000, content: "NIVO8F3K2", sender: "Anh Minh", eventId: "tx-1" })
        })

        it("accepts a numeric amount text and a numeric event id, and defaults the content and the payer", async () => {
            const { subject } = await buildSubject()

            expect(subject.simulatedCreditOf({ amount_vnd: "2500", event_id: 77, sender_name: "  " })).toEqual({
                amount: 2500,
                content: "",
                sender: null,
                eventId: "77",
            })
        })

        it("refuses an amount that is not above 0 and a missing or unusable event id", async () => {
            const { subject } = await buildSubject()

            expect(subject.simulatedCreditOf({ amount_vnd: 0, event_id: "a" })).toBeNull()
            expect(subject.simulatedCreditOf({ amount_vnd: -5, event_id: "a" })).toBeNull()
            expect(subject.simulatedCreditOf({ amount_vnd: "abc", event_id: "a" })).toBeNull()
            expect(subject.simulatedCreditOf({ amount_vnd: 10 })).toBeNull()
            expect(subject.simulatedCreditOf({ amount_vnd: 10, event_id: "  " })).toBeNull()
            expect(subject.simulatedCreditOf({ amount_vnd: 10, event_id: {} })).toBeNull()
        })
    })
})
