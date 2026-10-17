import { Test } from "@nestjs/testing"
import { toGapRecord } from "./gap-record.mapper"
import type { KnowledgeGapRow } from "./persistence/knowledge-gaps.rows"

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

        const row: KnowledgeGapRow = {
            id: "g1",
            module: "chatbot",
            question: "Tea price?",
            question_key: "tea-price",
            keywords: ["tea", "price"],
            topic: "Tea",
            attribute_guess: "Price",
            count: 3,
            first_seen_at: new Date("2026-10-10T10:00:00.000Z"),
            last_seen_at: "2026-10-12T10:00:00.000Z",
            example_conversation_id: "c1",
            status: "answered",
            reopened_count: 2,
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
