import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import type { LessonInput } from "./brain-lessons.contracts"
import { BrainLessonsService } from "./brain-lessons.service"
import type { BrainLessonRow } from "./persistence/brain-lessons.rows"
import {
    DECIDE_LESSON,
    INSERT_LESSON,
    RETIRE_LESSON,
    RETIRE_SUPERSEDED,
    SELECT_LESSONS,
    SELECT_LESSON_VERSION,
} from "./persistence/brain-lessons.sql"

const registerLessonListing = () => {
    it("lists mapped lessons for all statuses or the requested ones", async () => {
        const em = mockEntityManager({ query: [SELECT_LESSONS, [rowOf()]] })
        const service = await build(em)

        await expect(service.list(WS)).resolves.toEqual([lesson])
        await expect(service.list(WS, ["proposed", "active"])).resolves.toEqual([lesson])

        expect(em.query.mock.calls).toEqual([
            [SELECT_LESSONS, [WS, null]],
            [SELECT_LESSONS, [WS, ["proposed", "active"]]],
        ])
    })

    it("gives a module its active lessons and shared lessons", async () => {
        const em = mockEntityManager({
            query: [
                SELECT_LESSONS,
                [
                    rowOf({ id: "shared", module: null, status: "active" }),
                    rowOf({ status: "active" }),
                    rowOf({ id: "other", module: "sales", status: "active" }),
                ],
            ],
        })
        const service = await build(em)

        await expect(service.forModule(WS, "chatbot")).resolves.toEqual([
            { ...lesson, id: "shared", module: null, status: "active" },
            { ...lesson, status: "active" },
        ])

        expect(em.query).toHaveBeenCalledWith(SELECT_LESSONS, [WS, ["active"]])
    })

    describe("propose", () => {
        registerProposalValidation()
        registerProposalVersions()
    })
}

const registerDecide = () => {
    describe("decide", () => {
        it("retires the superseded active lesson after approving a replacement", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        DECIDE_LESSON,
                        [rowOf({ status: "active", supersedes_id: "l0", decided_by: "u2", decided_at: AT })],
                    ],
                    [RETIRE_SUPERSEDED, []],
                ],
            })
            const service = await build(em)

            await expect(service.decide(WS, "l1", "active", "u2")).resolves.toEqual({
                ...lesson,
                status: "active",
                decidedBy: "u2",
                decidedAt: AT,
            })

            expect(em.query.mock.calls).toEqual([
                [DECIDE_LESSON, [WS, "l1", "active", "u2"]],
                [RETIRE_SUPERSEDED, [WS, "l0"]],
            ])
        })

        it("rejects a replacement without retiring the lesson it would replace", async () => {
            const em = mockEntityManager({
                query: [DECIDE_LESSON, [rowOf({ status: "rejected", supersedes_id: "l0" })]],
            })
            const service = await build(em)

            await expect(service.decide(WS, "l1", "rejected", "u2")).resolves.toEqual({ ...lesson, status: "rejected" })

            expect(em.query.mock.calls).toEqual([[DECIDE_LESSON, [WS, "l1", "rejected", "u2"]]])
        })

        it("refuses a lesson that is not proposed", async () => {
            const service = await build(mockEntityManager({ query: [DECIDE_LESSON, []] }))

            await expect(service.decide(WS, "l1", "active", "u2")).rejects.toMatchObject({
                code: BrainLessonsErrorCode.NotProposed,
            })
        })
    })

    it("retires an active lesson and refuses a missing active row", async () => {
        const em = mockEntityManager({
            query: [
                [RETIRE_LESSON, [rowOf({ status: "retired", decided_by: "u2", decided_at: AT })]],
                [RETIRE_LESSON, []],
            ],
        })
        const service = await build(em)

        await expect(service.retire(WS, "l1", "u2")).resolves.toEqual({
            ...lesson,
            status: "retired",
            decidedBy: "u2",
            decidedAt: AT,
        })
        await expect(service.retire(WS, "l1", "u2")).rejects.toMatchObject({ code: BrainLessonsErrorCode.NotActive })

        expect(em.query.mock.calls).toEqual([
            [RETIRE_LESSON, [WS, "l1", "u2"]],
            [RETIRE_LESSON, [WS, "l1", "u2"]],
        ])
    })
}

const registerProposalValidation = () => {
    it("refuses an empty title or body before writing a lesson", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.propose(WS, inputOf({ title: " " }))).rejects.toMatchObject({
            code: BrainLessonsErrorCode.Incomplete,
        })
        await expect(service.propose(WS, inputOf({ body: " " }))).rejects.toMatchObject({
            code: BrainLessonsErrorCode.Incomplete,
        })

        expect(em.query).not.toHaveBeenCalled()
    })

    it("proposes trimmed text with the optional fields defaulted", async () => {
        const em = mockEntityManager({ query: [INSERT_LESSON, [rowOf()]] })
        const service = await build(em)

        await expect(service.propose(WS, inputOf())).resolves.toEqual(lesson)

        expect(em.query.mock.calls).toEqual([
            [
                INSERT_LESSON,
                [WS, "chatbot", "Ask once", "Ask for the missing size once.", "", "note", "[]", 1, null, "u1"],
            ],
        ])
    })

    it("limits title and body and stores trimmed applicability and evidence with the next version", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_LESSON_VERSION, [{ version: 3 }]],
                [INSERT_LESSON, [rowOf({ version: 4 })]],
            ],
        })
        const service = await build(em)

        await expect(
            service.propose(
                WS,
                inputOf({
                    title: ` ${"t".repeat(161)} `,
                    body: ` ${"b".repeat(2001)} `,
                    appliesWhen: " Size is missing ",
                    evidence: [{ kind: "note", ref: "n1", label: "Size" }],
                    supersedesId: "l0",
                    apply: false,
                }),
            ),
        ).resolves.toEqual({ ...lesson, version: 4 })

        expect(em.query.mock.calls).toEqual([
            [SELECT_LESSON_VERSION, [WS, "l0"]],
            [
                INSERT_LESSON,
                [
                    WS,
                    "chatbot",
                    "t".repeat(160),
                    "b".repeat(2000),
                    "Size is missing",
                    "note",
                    '[{"kind":"note","ref":"n1","label":"Size"}]',
                    4,
                    "l0",
                    "u1",
                ],
            ],
        ])
    })
}

const registerProposalVersions = () => {
    it("starts at version one when the replaced lesson cannot be found", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_LESSON_VERSION, []],
                [INSERT_LESSON, [rowOf()]],
            ],
        })
        const service = await build(em)

        await expect(service.propose(WS, inputOf({ supersedesId: "missing" }))).resolves.toEqual(lesson)

        expect(em.query).toHaveBeenCalledWith(INSERT_LESSON, [
            WS,
            "chatbot",
            "Ask once",
            "Ask for the missing size once.",
            "",
            "note",
            "[]",
            1,
            "missing",
            "u1",
        ])
    })

    it("applies a manual proposal immediately through the decision path", async () => {
        const em = mockEntityManager({
            query: [
                [INSERT_LESSON, [rowOf({ origin: "manual" })]],
                [DECIDE_LESSON, [rowOf({ origin: "manual", status: "active", decided_by: "u1", decided_at: AT })]],
            ],
        })
        const service = await build(em)

        await expect(service.propose(WS, inputOf({ origin: "manual", module: null, apply: true }))).resolves.toEqual({
            ...lesson,
            origin: "manual",
            status: "active",
            decidedBy: "u1",
            decidedAt: AT,
        })

        expect(em.query.mock.calls).toEqual([
            [
                INSERT_LESSON,
                [WS, null, "Ask once", "Ask for the missing size once.", "", "manual", "[]", 1, null, "u1"],
            ],
            [DECIDE_LESSON, [WS, "l1", "active", "u1"]],
        ])
    })

    it("reports a missing proposal row", async () => {
        const em = mockEntityManager({ query: [INSERT_LESSON, []] })
        const service = await build(em)

        await expect(service.propose(WS, inputOf())).rejects.toMatchObject({
            code: BrainLessonsErrorCode.NotProposed,
        })

        expect(em.query).toHaveBeenCalledTimes(1)
    })
}

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

const rowOf = (changes: Partial<BrainLessonRow> = {}): BrainLessonRow => ({
    id: "l1",
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    applies_when: "Size is missing",
    status: "proposed",
    origin: "note",
    evidence: [],
    version: 1,
    supersedes_id: null,
    proposed_by: "u1",
    proposed_at: AT,
    decided_by: null,
    decided_at: null,
    ...changes,
})

const lesson = {
    id: "l1",
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    appliesWhen: "Size is missing",
    status: "proposed",
    origin: "note",
    evidence: [],
    version: 1,
    proposedBy: "u1",
    proposedAt: AT,
    decidedBy: null,
    decidedAt: null,
}

const inputOf = (changes: Partial<LessonInput> = {}): LessonInput => ({
    module: "chatbot",
    title: " Ask once ",
    body: " Ask for the missing size once. ",
    origin: "note",
    proposedBy: "u1",
    ...changes,
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainLessonsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainLessonsService)
}

describe("BrainLessonsService", () => {
    registerLessonListing()
    registerDecide()
})
