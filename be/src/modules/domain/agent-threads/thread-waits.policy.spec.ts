import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    isWaitPayload,
    parkOfWaitQuestion,
    runSubjectOf,
    timeoutMsOf,
    waitCameOf,
    waitOnOf,
    waitOutputOf,
    waitParkOf,
    waitTakes,
} from "./thread-waits.policy"

// The pure half of `wait` on a thread: which event a parked wait takes (verb, `where`, the run's subject or the wait's match), the park
// read back from the checkpoint, and the output of what came.
const on = waitOnOf([
    {
        key: "paid",
        verb: TRIGGER.paymentCreditReceived,
        match: [{ member: "content", op: "contains", value: "dh a12", caseFold: true }],
    },
    { key: "replied", verb: TRIGGER.zaloMessageReceived, where: [{ param: "text", op: "present" }] },
])

const park = waitParkOf("hold", "2026-11-13T05:00:00.000Z", on ?? [], runSubjectOf(on ?? [], { conversationId: "c-1", contactId: "p-1", noteId: "n" }))

describe("waitTakes", () => {
    it("a credit is taken by its match (no subject join), folded case", () => {
        expect(waitTakes(park, TRIGGER.paymentCreditReceived, { transactionId: "t-9", content: "CK DH A12" })).toBe("paid")
        expect(waitTakes(park, TRIGGER.paymentCreditReceived, { transactionId: "t-9", content: "CK DH A13" })).toBeNull()
    })

    it("a line is taken by the run's subject (the same conversation or contact) and its `where`", () => {
        expect(waitTakes(park, TRIGGER.zaloMessageReceived, { conversationId: "c-1", text: "ok" })).toBe("replied")
        expect(waitTakes(park, TRIGGER.zaloMessageReceived, { conversationId: "c-2", contactId: "p-1", text: "ok" })).toBe("replied")
        expect(waitTakes(park, TRIGGER.zaloMessageReceived, { conversationId: "c-2", text: "ok" })).toBeNull()
        expect(waitTakes(park, TRIGGER.zaloMessageReceived, { conversationId: "c-1", text: "" })).toBeNull()
    })

    it("a verb the wait does not list is never taken", () => {
        expect(waitTakes(park, TRIGGER.telegramMessageReceived, { conversationId: "c-1", text: "ok" })).toBeNull()
    })
})

describe("the park and what came", () => {
    it("keeps the run's subject members only, and reads back from the checkpoint as written", () => {
        expect(park.subject).toEqual({ conversationId: "c-1", contactId: "p-1" })
        expect(parkOfWaitQuestion(JSON.parse(JSON.stringify(park)))).toEqual(park)
        expect(parkOfWaitQuestion({ kind: "until_round" })).toBeNull()
    })

    it("answers the key and the event, or the timeout; a resume value of another park is no answer", () => {
        expect(waitOutputOf({ key: "replied", event: { text: "ok" } })).toEqual({ trigger: "replied", event: { text: "ok" } })
        expect(waitOutputOf({ timeout: true })).toEqual({ trigger: "timeout" })
        expect(waitCameOf({ kind: "wait", parkKey: "hold", came: { timeout: true } }, "hold")).toEqual({ timeout: true })
        expect(waitCameOf({ kind: "wait", parkKey: "other", came: { timeout: true } }, "hold")).toBeNull()
    })

    it("reads one unit of timeout, and marks its deadline apart from a stop's and a round's", () => {
        expect([timeoutMsOf({ minutes: 30 }), timeoutMsOf({ hours: 2 }), timeoutMsOf({ minutes: 1, hours: 1 })]).toEqual([
            1_800_000,
            7_200_000,
            null,
        ])
        expect([isWaitPayload({ answered: -2 }), isWaitPayload({ answered: -1 }), isWaitPayload({ answered: 0 })]).toEqual([
            true,
            false,
            false,
        ])
    })
})
