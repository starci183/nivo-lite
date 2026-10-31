import type * as SubjectModule from "./sales-conversations.mapper"
import { Test } from "@nestjs/testing"
import { conversationByLeadOf, conversationOf } from "./sales-conversations.mapper"

const SUBJECT = Symbol("sales-conversations.mapper")
type Subject = Pick<typeof SubjectModule, "conversationByLeadOf" | "conversationOf">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { conversationByLeadOf, conversationOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("sales conversations mapper", () => {
    it("keeps the first conversation of each customer, which is the newest, and skips a conversation with no customer", async () => {
        const subject = await buildSubject()

        const byLead = subject.conversationByLeadOf([
            { id: "newest", lead_id: "lead-1" },
            { id: "stranger", lead_id: null },
            { id: "other", lead_id: "lead-2" },
            { id: "older", lead_id: "lead-1" },
        ])

        expect([...byLead]).toEqual([
            ["lead-1", "newest"],
            ["lead-2", "other"],
        ])
    })

    it("opens a customer on their conversation, and nothing for a customer who never wrote or for no customer", async () => {
        const subject = await buildSubject()
        const byLead = subject.conversationByLeadOf([{ id: "c-1", lead_id: "lead-1" }])

        expect(subject.conversationOf(byLead, "lead-1")).toBe("c-1")
        expect(subject.conversationOf(byLead, "silent")).toBeNull()
        expect(subject.conversationOf(byLead, null)).toBeNull()
    })
})
