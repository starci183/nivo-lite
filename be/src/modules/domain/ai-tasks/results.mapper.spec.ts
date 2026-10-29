import { Test } from "@nestjs/testing"
import {
    authorityChangeOf,
    classificationOf,
    designedModuleOf,
    extractedOrderOf,
    proposedCommandOf,
    responsibilityOf,
} from "./results.mapper"

const SUBJECT = Symbol("results.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    classificationOf,
                    extractedOrderOf,
                    responsibilityOf,
                    designedModuleOf,
                    authorityChangeOf,
                    proposedCommandOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./results.mapper")>(SUBJECT)
}

describe("results mapper", () => {
    describe("classificationOf", () => {
        it("keeps a valid stage and clamps the confidence", async () => {
            const subject = await buildSubject()

            expect(
                subject.classificationOf({
                    stage: "qualified",
                    confidence: 3,
                    next_action: "Call",
                    missing: ["phone", 7],
                    context: "- who",
                }),
            ).toEqual({
                stage: "qualified",
                confidence: 1,
                next_action: "Call",
                missing: ["phone", "7"],
                context: "- who",
            })
            expect(subject.classificationOf({ stage: "won", confidence: -2 })).toMatchObject({
                stage: "won",
                confidence: 0,
            })
        })

        it("falls back to a new lead with half confidence", async () => {
            const subject = await buildSubject()

            expect(subject.classificationOf({ stage: "weird" })).toEqual({
                stage: "new",
                confidence: 0.5,
                next_action: "",
                missing: [],
                context: "",
            })
        })
    })

    describe("extractedOrderOf", () => {
        it("rounds a stated total and never guesses one", async () => {
            const subject = await buildSubject()

            expect(subject.extractedOrderOf({ items: "Combo", amount_vnd: 1500000.4, confidence: 0.9 })).toEqual({
                items: "Combo",
                amount_vnd: 1500000,
                confidence: 0.9,
            })
            expect(subject.extractedOrderOf({ items: "Combo", amount_vnd: -5 })).toEqual({
                items: "Combo",
                amount_vnd: null,
                confidence: 0.5,
            })
            expect(subject.extractedOrderOf({})).toEqual({ items: "", amount_vnd: null, confidence: 0.5 })
        })
    })
})

describe("results mapper", () => {
    describe("responsibilityOf and designedModuleOf", () => {
        it("reads a proposed responsibility, defaulting to the human owner", async () => {
            const subject = await buildSubject()

            expect(
                subject.responsibilityOf({
                    title: "T",
                    owner_kind: "agent",
                    owner_handle: "sales",
                    next_action: "N",
                    due_in_days: 3,
                    rationale: "R",
                }),
            ).toEqual({
                title: "T",
                owner_kind: "agent",
                owner_handle: "sales",
                next_action: "N",
                due_in_days: 3,
                rationale: "R",
            })
            expect(subject.responsibilityOf({ owner_kind: "robot" })).toEqual({
                title: "",
                owner_kind: "human",
                owner_handle: null,
                next_action: "",
                due_in_days: 1,
                rationale: "",
            })
        })

        it("reads a designed agent", async () => {
            const subject = await buildSubject()

            expect(subject.designedModuleOf({ name: "N", handle: "h", role: "r", instructions: "i" })).toEqual({
                name: "N",
                handle: "h",
                role: "r",
                instructions: "i",
            })
            expect(subject.designedModuleOf({})).toEqual({ name: "", handle: "", role: "", instructions: "" })
        })
    })
})

describe("results mapper", () => {
    describe("authorityChangeOf", () => {
        it("reads every part of the owner's grant", async () => {
            const subject = await buildSubject()
            expect(
                subject.authorityChangeOf({
                    goals: { revenue_vnd: 300000000, new_customers: 4, first_reply_minutes: 5, note: "grow" },
                    policies_add: ["Deposit 30%", ""],
                    reply_style: "short",
                    brand_voice: "warm",
                    limits_note_add: "price changes",
                    rules: [
                        { action: "confirm_order", mode: "ask", limit_vnd: 20000000 },
                        { action: "issue_invoice", mode: "weird" },
                        { mode: "auto" },
                    ],
                    understood: true,
                }),
            ).toEqual({
                goals: { revenue_vnd: 300000000, new_customers: 4, first_reply_minutes: 5, note: "grow" },
                policies_add: ["Deposit 30%"],
                reply_style: "short",
                brand_voice: "warm",
                limits_note_add: "price changes",
                rules: [
                    { action: "confirm_order", mode: "ask", limit_vnd: 20000000 },
                    { action: "issue_invoice", mode: null, limit_vnd: null },
                ],
                understood: true,
            })
        })
        it("treats an empty answer as understood but granting nothing, and false as not understood", async () => {
            const subject = await buildSubject()
            expect(subject.authorityChangeOf({})).toEqual({
                goals: { revenue_vnd: null, new_customers: null, first_reply_minutes: null, note: null },
                policies_add: [],
                reply_style: null,
                brand_voice: null,
                limits_note_add: null,
                rules: [],
                understood: true,
            })
            expect(subject.authorityChangeOf({ understood: false }).understood).toBe(false)
        })
    })
    describe("proposedCommandOf", () => {
        it("reads a command with trimmed ids and only text or numeric fields", async () => {
            const subject = await buildSubject()

            expect(
                subject.proposedCommandOf({
                    intent: "command",
                    command: " issue_receipt ",
                    subject_id: "o-1",
                    lead_id: "  ",
                    fields: { amount: 5, note: " hi ", blank: " ", bad: Number.NaN, nested: { a: 1 } },
                }),
            ).toEqual({
                intent: "command",
                command: "issue_receipt",
                subject_id: "o-1",
                lead_id: null,
                fields: { amount: 5, note: "hi" },
            })
        })

        it("reads a question and defaults an empty answer to an empty command", async () => {
            const subject = await buildSubject()

            expect(subject.proposedCommandOf({ intent: "question", command: "x" }).intent).toBe("question")
            expect(subject.proposedCommandOf({})).toEqual({
                intent: "command",
                command: null,
                subject_id: null,
                lead_id: null,
                fields: {},
            })
        })
    })
})
