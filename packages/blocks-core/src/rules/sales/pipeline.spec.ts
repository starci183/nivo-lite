import { channelName, columnCountOf, pipelineCardsOf, pipelineStagesOf } from "./pipeline"
import type { PipelineFormats, PipelineWords } from "./pipeline"

const WORDS: PipelineWords = {
    order: "Order {count}",
    quote: "Quote {count}",
    next: "Next: {count}",
    due: "due {count}",
    owner: "Owner: {count}",
    reason: "Reason: {count}",
}
const FORMATS: PipelineFormats = {
    money: (value) => `${value} VND`,
    day: (value) => value.slice(5, 10),
}

const cardOf = (record: unknown) => pipelineCardsOf([record], WORDS, FORMATS)[0]

describe("channelName", () => {
    it("writes the first letter of a channel in capitals", () => {
        expect(channelName("zalo")).toBe("Zalo")
        expect(channelName("")).toBe("")
    })
})

describe("pipelineCardsOf", () => {
    it("heads a card with the customer and the company, and puts a new lead's channel and owner under it", () => {
        expect(
            cardOf({
                id: "l1",
                stage: "new",
                contactName: "Lan",
                company: "Hoa Sen Spa",
                need: "Ten sessions",
                channel: "zalo",
                owner: "Minh",
            }),
        ).toEqual({
            id: "l1",
            column: "new",
            title: "Lan \u00b7 Hoa Sen Spa",
            description: "Ten sessions",
            detail: "Zalo \u00b7 Owner: Minh",
            meta: "",
        })
    })

    it("leaves out what a new lead lacks: the company and the owner", () => {
        expect(cardOf({ id: "l2", stage: "new", contactName: "Tuan", channel: "website" })).toMatchObject({
            title: "Tuan",
            detail: "Website",
        })
    })

    it("tells the next step and when it is due for a qualified or proposal deal, with the note when there is no step", () => {
        expect(
            cardOf({ id: "l3", stage: "qualified", contactName: "A", nextStep: "Send quote", nextDueAt: "2026-11-06" })
                ?.detail,
        ).toBe("Next: Send quote \u00b7 due 11-06")
        expect(cardOf({ id: "l4", stage: "proposal", contactName: "B", nextStep: "Call back" })?.detail).toBe(
            "Next: Call back",
        )
        expect(
            cardOf({ id: "l5", stage: "proposal", contactName: "C", note: "Waiting for quote approval" })?.detail,
        ).toBe("Waiting for quote approval")
    })

    it("draws an order amount before a quote amount before the need", () => {
        expect(
            cardOf({ id: "l6", stage: "won", contactName: "D", orderVnd: 4_800_000, quoteVnd: 1, need: "x" })
                ?.description,
        ).toBe("Order 4800000 VND")
        expect(
            cardOf({ id: "l7", stage: "proposal", contactName: "E", quoteVnd: 12_500_000, need: "x" })?.description,
        ).toBe("Quote 12500000 VND")
        expect(
            cardOf({ id: "l8", stage: "proposal", contactName: "F", quoteVnd: "n/a", need: "Urgent" })?.description,
        ).toBe("Urgent")
    })

    it("tells a won deal's note, and a lost deal's reason with the day it was lost", () => {
        expect(cardOf({ id: "l9", stage: "won", contactName: "G", note: "Sent to accounting" })?.detail).toBe(
            "Sent to accounting",
        )
        expect(
            cardOf({
                id: "l10",
                stage: "lost",
                contactName: "H",
                closedReason: "chose a nearer shop",
                updatedAt: "2026-11-02T03:00:00Z",
            }),
        ).toMatchObject({ detail: "Reason: chose a nearer shop", meta: "11-02" })
        expect(cardOf({ id: "l11", stage: "lost", contactName: "I" })).toMatchObject({ detail: "", meta: "" })
    })

    it("draws a stage it does not know with no line, and leaves out a record with no id", () => {
        expect(cardOf({ id: "l12", stage: "archived", contactName: "J" })?.detail).toBe("")
        expect(pipelineCardsOf([{ contactName: "No id" }], WORDS, FORMATS)).toEqual([])
    })
})

describe("pipelineStagesOf and columnCountOf", () => {
    it("lists the stages in the order of the pipeline, all of them or those the spec shows", () => {
        expect(pipelineStagesOf(undefined)).toEqual(["new", "qualified", "proposal", "won", "lost"])
        expect(pipelineStagesOf(["lost", "new"])).toEqual(["new", "lost"])
    })

    it("counts a column from the counts read, else from its cards, else not at all while more cards may load", () => {
        const counts = { counts: { new: 6 }, total: 30 }
        expect(columnCountOf(counts, "new", 2, true)).toBe(6)
        expect(columnCountOf(counts, "won", 2, false)).toBe(2)
        expect(columnCountOf(null, "won", 2, false)).toBe(2)
        expect(columnCountOf(null, "won", 2, true)).toBeUndefined()
    })
})
