import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainEvalCasesService } from "./brain-eval-cases.service"
import { INSERT_EVAL_CASES } from "./persistence/brain-eval-cases.sql"

const WS = "11111111-1111-4111-8111-111111111111"

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

            expect(em.query).not.toHaveBeenCalled()
        })

        it("serializes the ordered cases and answers how many the database inserted", async () => {
            const em = mockEntityManager({ query: [INSERT_EVAL_CASES, [{ id: "c1" }]] })
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

            expect(em.query).toHaveBeenCalledWith(INSERT_EVAL_CASES, [
                WS,
                "chatbot",
                ["decision:1", "decision:2"],
                ['{"question":"Hours?","context":["store","weekday"]}', '{"question":"Price?","count":2}'],
                ['{"text":"Open 8 to 21","confirmed":true}', '{"price":12,"note":null}'],
            ])
        })

        it("answers zero when every case was already kept", async () => {
            const em = mockEntityManager({ query: [INSERT_EVAL_CASES, []] })
            const service = await build(em)

            await expect(
                service.keep(WS, "chatbot", [{ originRef: "decision:1", input: {}, expected: {} }]),
            ).resolves.toBe(0)

            expect(em.query).toHaveBeenCalledWith(INSERT_EVAL_CASES, [WS, "chatbot", ["decision:1"], ["{}"], ["{}"]])
        })
    })
})
