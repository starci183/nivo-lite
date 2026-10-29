import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import type { LessonInput } from "./brain-lessons.contracts"
import { BrainLessonsService } from "./brain-lessons.service"
import { BrainLessonEntity } from "./persistence/entities"

const registerLessonListing = () => {
    it("lists mapped lessons for all statuses or the requested ones", async () => {
        const em = mockEntityManager({ find: [BrainLessonEntity, [rowOf()]] })
        const service = await build(em)

        await expect(service.list(WS)).resolves.toEqual([lesson])
        await expect(service.list(WS, ["proposed", "active"])).resolves.toEqual([lesson])

        expect(evaluatedCalls(em.find.mock.calls)).toEqual([
            ["BrainLessonEntity", { where: { workspaceId: WS }, order: { proposedAt: "DESC" }, take: 500 }],
            [
                "BrainLessonEntity",
                {
                    where: { workspaceId: WS, status: In(["proposed", "active"]) },
                    order: { proposedAt: "DESC" },
                    take: 500,
                },
            ],
        ])
    })

    it("gives a module its active lessons and shared lessons", async () => {
        const em = mockEntityManager({
            find: [
                BrainLessonEntity,
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

        expect(em.find).toHaveBeenCalledWith(BrainLessonEntity, {
            where: { workspaceId: WS, status: In(["active"]) },
            order: { proposedAt: "DESC" },
            take: 500,
        })
    })

    describe("propose", () => {
        registerProposalValidation()
        registerProposalVersions()
    })
}

const registerDecide = () => {
    describe("decide", () => {
        it("retires the superseded active lesson after approving a replacement", async () => {
            const em = mockEntityManager({ update: [BrainLessonEntity, { affected: 1 }] })
            const [decide] = queueQueryBuilders(em, [
                {
                    execute: {
                        raw: [
                            rowOf({ status: "active", supersedesId: "l0", decidedBy: "u2", decidedAt: new Date(AT) }),
                        ],
                    },
                },
            ])
            const service = await build(em)

            await expect(service.decide(WS, "l1", "active", "u2")).resolves.toEqual({
                ...lesson,
                status: "active",
                decidedBy: "u2",
                decidedAt: AT,
            })

            expect(em.createQueryBuilder).toHaveBeenCalledWith(BrainLessonEntity, "bl")
            expect(decide?.callsOf("where")).toEqual([[{ workspaceId: WS, id: "l1", status: "proposed" }]])
            expect(evaluatedValues(decide?.callsOf("set")[0]?.[0])).toEqual({
                status: "active",
                decidedBy: "u2",
                decidedAt: "now()",
            })
            expect(evaluatedCalls(em.update.mock.calls)).toEqual([
                ["BrainLessonEntity", { workspaceId: WS, id: "l0", status: "active" }, { status: "retired" }],
            ])
        })

        it("rejects a replacement without retiring the lesson it would replace", async () => {
            const em = mockEntityManager()
            const [decide] = queueQueryBuilders(em, [
                { execute: { raw: [rowOf({ status: "rejected", supersedesId: "l0" })] } },
            ])
            const service = await build(em)

            await expect(service.decide(WS, "l1", "rejected", "u2")).resolves.toEqual({ ...lesson, status: "rejected" })

            expect(setOf(decide)).toMatchObject({ status: "rejected", decidedBy: "u2" })
            expect(em.update).not.toHaveBeenCalled()
        })

        it("refuses a lesson when the statement hands back no rows at all", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ execute: {} }])
            const service = await build(em)

            await expect(service.decide(WS, "l1", "active", "u2")).rejects.toMatchObject({
                code: BrainLessonsErrorCode.NotProposed,
            })
        })

        it("refuses a lesson that is not proposed", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const service = await build(em)

            await expect(service.decide(WS, "l1", "active", "u2")).rejects.toMatchObject({
                code: BrainLessonsErrorCode.NotProposed,
            })
        })
    })

    it("retires an active lesson and refuses a missing active row", async () => {
        const em = mockEntityManager()
        const [first, second] = queueQueryBuilders(em, [
            { execute: { raw: [rowOf({ status: "retired", decidedBy: "u2", decidedAt: new Date(AT) })] } },
            { execute: { raw: [] } },
        ])
        const service = await build(em)

        await expect(service.retire(WS, "l1", "u2")).resolves.toEqual({
            ...lesson,
            status: "retired",
            decidedBy: "u2",
            decidedAt: AT,
        })
        await expect(service.retire(WS, "l1", "u2")).rejects.toMatchObject({ code: BrainLessonsErrorCode.NotActive })

        for (const fake of [first, second]) {
            expect(fake?.callsOf("where")).toEqual([[{ workspaceId: WS, id: "l1", status: "active" }]])
            expect(evaluatedValues(fake?.callsOf("set")[0]?.[0])).toEqual({
                status: "retired",
                decidedBy: "u2",
                decidedAt: "now()",
            })
        }
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

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("proposes trimmed text with the optional fields defaulted", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rowOf()] } }])
        const service = await build(em)

        await expect(service.propose(WS, inputOf())).resolves.toEqual(lesson)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(BrainLessonEntity, "bl")
        expect(insert?.callsOf("values")).toEqual([[valuesOf()]])
    })

    it("limits title and body and stores trimmed applicability and evidence with the next version", async () => {
        const em = mockEntityManager({ findOne: [BrainLessonEntity, rowOf({ version: 3 })] })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rowOf({ version: 4 })] } }])
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

        expect(em.findOne).toHaveBeenCalledWith(BrainLessonEntity, {
            select: { version: true },
            where: { workspaceId: WS, id: "l0" },
        })
        expect(insert?.callsOf("values")).toEqual([
            [
                valuesOf({
                    title: "t".repeat(160),
                    body: "b".repeat(2000),
                    appliesWhen: "Size is missing",
                    evidence: [{ kind: "note", ref: "n1", label: "Size" }],
                    version: 4,
                    supersedesId: "l0",
                }),
            ],
        ])
    })
}

const registerProposalVersions = () => {
    it("starts at version one when the replaced lesson cannot be found", async () => {
        const em = mockEntityManager({ findOne: [BrainLessonEntity, null] })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [rowOf()] } }])
        const service = await build(em)

        await expect(service.propose(WS, inputOf({ supersedesId: "missing" }))).resolves.toEqual(lesson)

        expect(insert?.callsOf("values")).toEqual([[valuesOf({ supersedesId: "missing" })]])
    })

    it("applies a manual proposal immediately through the decision path", async () => {
        const em = mockEntityManager()
        const [insert, decide] = queueQueryBuilders(em, [
            { execute: { raw: [rowOf({ origin: "manual" })] } },
            {
                execute: {
                    raw: [rowOf({ origin: "manual", status: "active", decidedBy: "u1", decidedAt: new Date(AT) })],
                },
            },
        ])
        const service = await build(em)

        await expect(service.propose(WS, inputOf({ origin: "manual", module: null, apply: true }))).resolves.toEqual({
            ...lesson,
            origin: "manual",
            status: "active",
            decidedBy: "u1",
            decidedAt: AT,
        })

        expect(insert?.callsOf("values")).toEqual([[valuesOf({ module: null, origin: "manual" })]])
        expect(decide?.callsOf("where")).toEqual([[{ workspaceId: WS, id: "l1", status: "proposed" }]])
        expect(setOf(decide)).toMatchObject({ status: "active", decidedBy: "u1" })
    })

    it("reports a missing proposal row", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await expect(service.propose(WS, inputOf())).rejects.toMatchObject({
            code: BrainLessonsErrorCode.NotProposed,
        })

        expect(insert?.callsOf("execute")).toHaveLength(1)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
}

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

const rowOf = entityRowBuilder<BrainLessonEntity>({
    id: "l1",
    workspaceId: WS,
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    appliesWhen: "Size is missing",
    status: "proposed",
    origin: "note",
    evidence: [],
    version: 1,
    supersedesId: null,
    proposedBy: "u1",
    proposedAt: new Date(AT),
    decidedBy: null,
    decidedAt: null,
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

/** The values a proposal writes, with what a case changes. */
const valuesOf = (changes: Readonly<Record<string, unknown>> = {}) => ({
    workspaceId: WS,
    module: "chatbot",
    title: "Ask once",
    body: "Ask for the missing size once.",
    appliesWhen: "",
    status: "proposed",
    origin: "note",
    evidence: [],
    version: 1,
    supersedesId: null,
    proposedBy: "u1",
    ...changes,
})

/** The values one fake builder was given to `set`. */
const setOf = (fake: FakeQueryBuilder | undefined): Partial<BrainLessonEntity> => {
    const [args] = fake?.callsOf("set") ?? []
    return { ...(args?.[0] ?? {}) }
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
