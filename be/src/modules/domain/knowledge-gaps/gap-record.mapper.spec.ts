import { toGapRecord } from "./gap-record.mapper"
import type { KnowledgeGapRow } from "./persistence/knowledge-gaps.rows"

describe("toGapRecord", () => {
    it("names every stored gap field and renders driver Dates and timestamp strings", () => {
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

        expect(toGapRecord(row)).toEqual({
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
