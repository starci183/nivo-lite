import { Test } from "@nestjs/testing"
import { toLessonRecord } from "./lesson-record.mapper"
import type { BrainLessonEntity } from "./persistence/entities"

const SUBJECT = Symbol("lesson-record.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toLessonRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./lesson-record.mapper")>(SUBJECT)
}

const rowOf = (changes: Partial<BrainLessonEntity> = {}): BrainLessonEntity => ({
    id: "l1",
    workspaceId: "w1",
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    appliesWhen: "Size is missing",
    status: "active",
    origin: "manual",
    evidence: [{ kind: "note", ref: "n1", label: "Size" }],
    version: 2,
    supersedesId: "l0",
    proposedBy: "u1",
    proposedAt: new Date("2026-10-10T10:00:00.000Z"),
    decidedBy: "u2",
    decidedAt: new Date("2026-10-12T10:00:00.000Z"),
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
    })

    it("keeps an empty evidence list (the column is NOT NULL with a [] default, so there is no null to default) and keeps an undecided timestamp null", async () => {
        const subject = await buildSubject()

        expect(subject.toLessonRecord(rowOf({ evidence: [], decidedBy: null, decidedAt: null }))).toEqual({
            ...lesson,
            evidence: [],
            decidedBy: null,
            decidedAt: null,
        })
    })
})
