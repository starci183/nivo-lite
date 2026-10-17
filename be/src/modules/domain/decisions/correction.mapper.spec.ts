import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { toCorrection } from "./correction.mapper"
import type { CorrectionRow } from "./persistence/corrections.rows"

const SUBJECT = Symbol("correction.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toCorrection } }],
    }).compile()
    return moduleRef.get<typeof import("./correction.mapper")>(SUBJECT)
}

const correctionRowOf = builder<CorrectionRow>({
    id: "decision-1",
    department: "sales",
    action: "send_follow_up",
    outcome: "edited",
    note: "Keep the payment details",
    created_at: "2026-10-15T09:15:00.000Z",
    before: { summary: "Follow up", draft: "Please pay", fields: { amount: 250 } },
    after: { summary: "Follow up", draft: "Please pay by Friday", fields: { amount: 250, due: "Friday" } },
})

describe("toCorrection", () => {
    it("maps the decision identity and preserves the complete proposal objects and note", async () => {
        const subject = await buildSubject()

        const row = correctionRowOf()

        const correction = subject.toCorrection(row)

        expect(correction).toEqual({
            decisionId: "decision-1",
            action: "send_follow_up",
            outcome: "edited",
            note: "Keep the payment details",
            at: "2026-10-15T09:15:00.000Z",
            before: row.before,
            after: row.after,
        })
        expect(correction.before).toBe(row.before)
        expect(correction.after).toBe(row.after)
    })

    it("keeps a rejected decision's null proposals and absent note", async () => {
        const subject = await buildSubject()

        const row = correctionRowOf({ outcome: "rejected", before: null, after: null, note: null })

        expect(subject.toCorrection(row)).toEqual({
            decisionId: "decision-1",
            action: "send_follow_up",
            outcome: "rejected",
            note: null,
            at: "2026-10-15T09:15:00.000Z",
            before: null,
            after: null,
        })
    })
})
