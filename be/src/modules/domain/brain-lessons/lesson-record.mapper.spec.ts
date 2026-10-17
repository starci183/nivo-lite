import { Test } from "@nestjs/testing"
import { toLessonRecord } from "./lesson-record.mapper"
import type { BrainLessonRow } from "./persistence/brain-lessons.rows"

const SUBJECT = Symbol("lesson-record.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toLessonRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./lesson-record.mapper")>(SUBJECT)
}

const rowOf = (changes: Partial<BrainLessonRow> = {}): BrainLessonRow => ({
    id: "l1",
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    applies_when: "Size is missing",
    status: "active",
    origin: "manual",
    evidence: [{ kind: "note", ref: "n1", label: "Size" }],
    version: 2,
    supersedes_id: "l0",
    proposed_by: "u1",
    proposed_at: new Date("2026-10-10T10:00:00.000Z"),
    decided_by: "u2",
    decided_at: "2026-10-12T10:00:00.000Z",
    ...changes,
})

const lesson = {
    id: "l1",
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    appliesWhen: "Size is missing",
    status: "active",
    origin: "manual",
    evidence: [{ kind: "note", ref: "n1", label: "Size" }],
    version: 2,
    proposedBy: "u1",
    proposedAt: "2026-10-10T10:00:00.000Z",
    decidedBy: "u2",
    decidedAt: "2026-10-12T10:00:00.000Z",
}

describe("toLessonRecord", () => {
    it("names every stored field, retaining evidence and converting timestamp values", async () => {
        const subject = await buildSubject()

        expect(subject.toLessonRecord(rowOf())).toEqual(lesson)
        expect(subject.toLessonRecord(rowOf({ decided_at: new Date("2026-10-12T10:00:00.000Z") }))).toEqual(lesson)
    })

    it("defaults null evidence to an empty list and keeps an undecided timestamp null", async () => {
        const subject = await buildSubject()

        expect(subject.toLessonRecord(rowOf({ evidence: null, decided_by: null, decided_at: null }))).toEqual({
            ...lesson,
            evidence: [],
            decidedBy: null,
            decidedAt: null,
        })
    })
})
