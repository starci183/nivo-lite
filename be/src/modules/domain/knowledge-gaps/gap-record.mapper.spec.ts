import { Test } from "@nestjs/testing"
import { toGapRecord } from "./gap-record.mapper"
import type { GapFields } from "./gap-record.mapper"

const SUBJECT = Symbol("gap-record.mapper")
type Subject = { toGapRecord: typeof toGapRecord }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toGapRecord } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("toGapRecord", () => {
    it("names every stored gap field and renders driver Dates and timestamp strings", async () => {
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
            lastSeenAt: "2026-10-12T10:00:00.000Z" as unknown as Date,
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
})
