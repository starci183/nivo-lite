import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull, Like } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainFactBatchService } from "./brain-fact-batch.service"

const WS = "ws-1"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainFactBatchService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainFactBatchService)
}

describe("BrainFactBatchService reopen", () => {
    it("takes a fact of the batch that is still in force and replaced nothing back to a waiting proposal", async () => {
        const em = mockEntityManager()
        const [reopen] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "f1" }] } }])
        const service = await build(em)

        await expect(service.reopen(WS, "f1", "b-1")).resolves.toBe(true)

        expect(reopen?.callsOf("where")[0]?.[0]).toEqual({
            workspaceId: WS,
            id: "f1",
            status: "active",
            supersedesId: IsNull(),
            decisionNote: Like("bulk:b-1%"),
        })
        expect(evaluatedValues(reopen?.callsOf("set")[0]?.[0])).toMatchObject({
            status: "proposed",
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
        })
    })

    it("leaves a fact that was retired, replaced or decided again since: no row matches", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await expect(service.reopen(WS, "f1", "b-1")).resolves.toBe(false)
    })
})
