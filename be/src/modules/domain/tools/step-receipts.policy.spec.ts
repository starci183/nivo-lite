import { receiptAt, sameArguments, stretchStartOf, type StepReceipt } from "./step-receipts.policy"

const SEND = "nivo.tool.customer.message.send"
const BEGAN = "2026-11-13T10:00:00.000Z"

const receiptOf = (text: string, at: string, id: string, effect: string = SEND): StepReceipt => ({
    effect,
    args: { conversationId: "c-1", text },
    subject: { kind: "message", id },
    at,
})

const FIRST = receiptOf("một", "2026-11-13T09:00:00.000Z", "m-1")
const SECOND = receiptOf("hai", "2026-11-13T09:00:05.000Z", "m-2")

describe("receiptAt: a step that runs again answers its earlier writes by position (nivo-frame rights 11d)", () => {
    it("answers the earlier attempt's write at the same position when the arguments differ", () => {
        const ask = { effect: SEND, args: { conversationId: "c-1", text: "một (reworded)" }, startedAt: BEGAN, answers: undefined }
        expect(receiptAt([SECOND, FIRST], { ...ask, position: 1 })).toEqual(FIRST)
        expect(receiptAt([SECOND, FIRST], { ...ask, position: 2 })).toEqual(SECOND)
        expect(receiptAt([SECOND, FIRST], { ...ask, position: 3 })).toBeNull()
    })

    it("leaves the same arguments to the ledger's own key (null)", () => {
        expect(
            receiptAt([FIRST], { effect: SEND, args: { text: "một", conversationId: "c-1" }, position: 1, startedAt: BEGAN, answers: [] }),
        ).toBeNull()
    })

    it("never counts a write of this attempt, another effect, or one before a person's words", () => {
        const now = receiptOf("x", "2026-11-13T10:00:01.000Z", "m-now")
        const other = receiptOf("x", "2026-11-13T09:00:00.000Z", "t-1", "nivo.tool.team.message.post")
        const ask = { effect: SEND, args: { text: "y" }, position: 1, startedAt: BEGAN }
        expect(receiptAt([now, other], { ...ask, answers: undefined })).toBeNull()
        expect(receiptAt([FIRST], { ...ask, answers: [{ text: "ghi nhận", at: "2026-11-13T09:30:00.000Z" }] })).toBeNull()
    })
})

describe("stretchStartOf: only a person's words start a new stretch", () => {
    it("reads the newest person's answer and ignores the engine's own words", () => {
        expect(stretchStartOf(undefined)).toBeNull()
        const engine = { text: "ran", at: "2026-11-13T09:40:00.000Z", by: "engine" }
        expect(stretchStartOf([engine])).toBeNull()
        expect(stretchStartOf([{ text: "ok", at: "2026-11-13T09:30:00.000Z" }, engine])).toBe(Date.parse("2026-11-13T09:30:00.000Z"))
    })
})

describe("sameArguments", () => {
    it("compares members whatever their order, and nothing equals unkept arguments", () => {
        expect(sameArguments({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
        expect(sameArguments({ a: 1 }, { a: 2 })).toBe(false)
        expect(sameArguments(null, {})).toBe(false)
    })
})
