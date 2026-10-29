import { Test } from "@nestjs/testing"
import { isGapReturned, toGapFields, toGapRecord } from "./gap-record.mapper"
import type { GapFields } from "./gap-record.mapper"

const SUBJECT = Symbol("gap-record.mapper")
type Subject = { toGapRecord: typeof toGapRecord; toGapFields: typeof toGapFields }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toGapRecord, toGapFields } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("toGapRecord", () => {
    it("names every stored gap field and renders driver Dates", async () => {
        const subject = await build()

        const row: GapFields = {
            id: "g1",
            module: "chatbot",
            question: "Tea price?",
            questionKey: "tea-price",
            keywords: ["tea", "price"],
            topic: "Tea",
            attributeGuess: "Price",
            count: 3,
            firstSeenAt: new Date("2026-10-10T10:00:00.000Z"),
            lastSeenAt: new Date("2026-10-12T10:00:00.000Z"),
            exampleConversationId: "c1",
            status: "answered",
            reopenedCount: 2,
        }

        expect(subject.toGapRecord(row)).toEqual({
            id: "g1",
            module: "chatbot",
            question: "Tea price?",
            topic: "Tea",
            attributeGuess: "Price",
            count: 3,
            firstSeenAt: "2026-10-10T10:00:00.000Z",
            lastSeenAt: "2026-10-12T10:00:00.000Z",
            exampleConversationId: "c1",
            status: "answered",
            reopenedCount: 2,
        })
    })

    it.each<readonly [string, unknown, ReadonlyArray<string>, string, string]>([
        ["keeps stored words and answered", ["tea", 7], ["tea"], "answered", "answered"],
        ["keeps dismissed", ["tea"], ["tea"], "dismissed", "dismissed"],
        ["reads absent keywords as none and an odd status as open", null, [], "weird", "open"],
    ])("normalises a returned row: %s", async (_name, keywords, expected, status, expectedStatus) => {
        const subject = await build()
        const returned = {
            id: "g1",
            module: "chatbot",
            question: "Tea price?",
            questionKey: "tea-price",
            keywords,
            topic: null,
            attributeGuess: null,
            count: 1,
            firstSeenAt: new Date("2026-10-10T10:00:00.000Z"),
            lastSeenAt: new Date("2026-10-10T10:00:00.000Z"),
            exampleConversationId: null,
            status,
            reopenedCount: 0,
        }

        expect(isGapReturned(returned)).toBe(true)
        const fields = subject.toGapFields(returned)
        expect(fields.keywords).toEqual(expected)
        expect(fields.status).toBe(expectedStatus)
    })
})
