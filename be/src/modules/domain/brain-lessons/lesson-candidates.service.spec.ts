import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In, IsNull, MoreThanOrEqual } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import type { LessonCandidateInput } from "./lesson-candidates.contracts"
import { LessonCandidatesService, factKeySlugOf } from "./lesson-candidates.service"
import { BrainLessonCandidateEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-11T09:00:00.000Z"
const SINCE = new Date("2026-10-12T12:00:00.000Z")

const rowOf = entityRowBuilder<BrainLessonCandidateEntity>({
    id: "c1",
    workspaceId: WS,
    stopId: "s1",
    runId: "r1",
    stepKey: "match",
    agentId: "a1",
    workflowId: "w1",
    question: "Chuyển khoản sai mã, có ghi nhận không?",
    keywords: ["chuyen", "khoan", "sai", "ghi", "nhan"],
    answer: "Ghi nhận cho đơn đang chờ",
    answeredBy: "m1",
    answeredAt: new Date(AT),
    thenDid: "completed",
    general: null,
    groupId: "g1",
    status: "candidate",
    changeId: null,
    factSlug: null,
    factKey: null,
    factId: null,
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
})

const input: LessonCandidateInput = {
    stopId: "s2",
    runId: "r2",
    stepKey: "match",
    agentId: "a1",
    workflowId: "w1",
    question: "Chuyển khoản mã DH202611118888 sai mã, có ghi nhận không? Khách 0912 345 678",
    answer: "Cứ ghi nhận cho đơn đang chờ, email a@b.vn",
    answeredBy: "m1",
    answeredAt: "2026-11-11T10:00:00.000Z",
    thenDid: "completed",
}

const build = async (em: ReturnType<typeof mockEntityManager>): Promise<LessonCandidatesService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [LessonCandidatesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(LessonCandidatesService)
}

describe("LessonCandidatesService", () => {
    it("reads the recent candidates of one place by the indexed columns, newest first", async () => {
        const em = mockEntityManager({ find: [BrainLessonCandidateEntity, [rowOf()]] })
        const service = await build(em)

        const [one] = await service.recent(WS, { agentId: "a1", workflowId: null, stepKey: "match" }, SINCE)

        expect(one).toMatchObject({ id: "c1", answeredAt: AT, groupId: "g1" })
        expect(evaluatedCalls(em.find.mock.calls)).toEqual([
            [
                "BrainLessonCandidateEntity",
                {
                    where: { workspaceId: WS, agentId: "a1", stepKey: "match", workflowId: IsNull(), answeredAt: MoreThanOrEqual(SINCE) },
                    order: { answeredAt: "DESC" },
                    take: 100,
                },
            ],
        ])
    })

    it("keeps a new answer masked, in the group of the nearest question, and says it is new", async () => {
        const em = mockEntityManager({
            find: [BrainLessonCandidateEntity, [rowOf()]],
            findOne: [BrainLessonCandidateEntity, rowOf({ id: "c2", stopId: "s2" })],
        })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "c2" }] } }])
        const service = await build(em)

        const kept = await service.keep(WS, input, SINCE)

        expect(kept).toMatchObject({ isNew: true, candidate: { id: "c2" } })
        const [values] = insert?.callsOf("values")[0] ?? []
        expect(values).toMatchObject({
            groupId: "g1",
            question: "Chuyển khoản mã DH… sai mã, có ghi nhận không? Khách …",
            answer: "Cứ ghi nhận cho đơn đang chờ, email …",
            stopId: "s2",
        })
        expect(Object.keys(values as object)).not.toContain("leadId")
        expect(insert?.callsOf("orIgnore")).toEqual([[]])
    })

    it("answers not-new when the unique key ignored the insert, and refuses a row it cannot read back", async () => {
        const em = mockEntityManager({ find: [BrainLessonCandidateEntity, []], findOne: [BrainLessonCandidateEntity, rowOf()] })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)
        await expect(service.keep(WS, input, SINCE)).resolves.toMatchObject({ isNew: false })

        const lost = mockEntityManager({ find: [BrainLessonCandidateEntity, []], findOne: [BrainLessonCandidateEntity, null] })
        queueQueryBuilders(lost, [{ execute: { raw: [] } }])
        await expect((await build(lost)).keep(WS, input, SINCE)).rejects.toMatchObject({
            code: BrainLessonsErrorCode.CandidateLost,
        })
    })

    it("claims only free candidates and gives them back when one was taken", async () => {
        const em = mockEntityManager({ update: [BrainLessonCandidateEntity, { affected: 1 }] })
        const service = await build(em)

        await expect(service.claim(WS, ["c1", "c2"])).resolves.toBe(false)

        expect(evaluatedCalls(em.update.mock.calls)).toEqual([
            ["BrainLessonCandidateEntity", { workspaceId: WS, id: In(["c1", "c2"]), status: In(["candidate"]) }, { status: "proposing" }],
            ["BrainLessonCandidateEntity", { workspaceId: WS, id: In(["c1", "c2"]), status: In(["proposing"]) }, { status: "candidate" }],
        ])
    })

    it("closes a card's candidates as learned with the truth, or frees them when superseded", async () => {
        const em = mockEntityManager({ update: [BrainLessonCandidateEntity, { affected: 2 }] })
        const service = await build(em)

        await expect(service.closeChange(WS, "ch1", "learned", "f1")).resolves.toBe(2)
        await service.closeChange(WS, "ch1", "candidate", null)

        expect(evaluatedCalls(em.update.mock.calls)).toEqual([
            ["BrainLessonCandidateEntity", { workspaceId: WS, changeId: "ch1", status: "proposed" }, { status: "learned", factId: "f1" }],
            [
                "BrainLessonCandidateEntity",
                { workspaceId: WS, changeId: "ch1", status: "proposed" },
                { status: "candidate", changeId: null, factKey: null, factSlug: null },
            ],
        ])
    })

    it("finds the open card of a key by its slug", async () => {
        const em = mockEntityManager({ findOne: [BrainLessonCandidateEntity, rowOf({ changeId: "ch1", status: "proposed" })] })
        const service = await build(em)
        const key = { subjectLabel: "Chuyển khoản sai mã", attributeLabel: "Đúng số tiền" }

        await expect(service.openOfKey(WS, key)).resolves.toBe("ch1")
        expect(factKeySlugOf(key)).toBe("chuyen-khoan-sai-ma|dung-so-tien")
    })
})
