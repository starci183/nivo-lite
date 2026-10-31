import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { BrainEvalCasesService } from "./brain-eval-cases.service"
import { BrainEvalCaseEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const rowOf = entityRowBuilder<BrainEvalCaseEntity>({
    id: "c1",
    workspaceId: WS,
    module: "chatbot",
    kind: "draft",
    input: {},
    expected: {},
    originRef: "decision:0",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    updatedAt: new Date("2026-10-13T02:00:00.000Z"),
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainEvalCasesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainEvalCasesService)
}

describe("BrainEvalCasesService", () => {
    describe("keep", () => {
        it("answers zero without querying when no cases are given", async () => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(service.keep(WS, "chatbot", [])).resolves.toBe(0)

            expect(em.find).not.toHaveBeenCalled()
            expect(em.insert).not.toHaveBeenCalled()
        })

        it("serializes the ordered cases and answers how many the database inserted", async () => {
            const em = mockEntityManager({
                find: [BrainEvalCaseEntity, [rowOf({ originRef: "decision:1" })]],
                insert: [BrainEvalCaseEntity, { identifiers: [{ id: "c2" }] }],
            })
            const service = await build(em)

            await expect(
                service.keep(WS, "chatbot", [
                    {
                        originRef: "decision:1",
                        input: { question: "Hours?", context: ["store", "weekday"] },
                        expected: { text: "Open 8 to 21", confirmed: true },
                    },
                    {
                        originRef: "decision:2",
                        input: { question: "Price?", count: 2 },
                        expected: { price: 12, note: null },
                    },
                ]),
            ).resolves.toBe(1)

            expect(em.find).toHaveBeenCalledWith(BrainEvalCaseEntity, {
                select: { originRef: true },
                where: { workspaceId: WS, originRef: In(["decision:1", "decision:2"]) },
                take: 2,
            })
            expect(em.insert).toHaveBeenCalledWith(BrainEvalCaseEntity, [
                {
                    workspaceId: WS,
                    module: "chatbot",
                    kind: "draft",
                    input: { question: "Price?", count: 2 },
                    expected: { price: 12, note: null },
                    originRef: "decision:2",
                },
            ])
        })

        it("answers zero when every case was already kept", async () => {
            const em = mockEntityManager({ find: [BrainEvalCaseEntity, [rowOf({ originRef: "decision:1" })]] })
            const service = await build(em)

            await expect(
                service.keep(WS, "chatbot", [{ originRef: "decision:1", input: {}, expected: {} }]),
            ).resolves.toBe(0)

            expect(em.insert).not.toHaveBeenCalled()
        })
    })
})
