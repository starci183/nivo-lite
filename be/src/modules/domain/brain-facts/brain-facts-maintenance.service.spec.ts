import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsMaintenanceService,
            BrainFactsReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsMaintenanceService)
}

/** A write that answered these facts. */
const answered = (...rows: ReadonlyArray<object>) => ({ execute: { raw: rows } })

const setOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("set")[0]?.[0])

const registerWithdraw = () => {
    it("withdraws document evidence, rejects unsupported proposals and returns document orphans", async () => {
        const em = mockEntityManager()
        const [read, reject, , , , supported] = queueQueryBuilders(em, [
            { getMany: facts.withdrawalRows },
            answered(facts.rowOf({ status: "rejected" })),
            { execute: {} },
            { execute: {} },
            { execute: {} },
            { execute: {} },
        ])
        await expect((await build(em)).withdrawSource(facts.WS, "doc-1", "Removed")).resolves.toEqual(["orphan"])
        expect(read?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: facts.WS,
            pattern: '[{"kind":"document","ref":"doc-1"}]',
        })
        expect(reject?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "proposed" }]])
        expect(setOf(reject)).toMatchObject({ decidedBy: "NIVO", decisionNote: "Removed" })
        expect(supported?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "supported" }]])
        expect(supported?.callsOf("setParameter")).toEqual([
            ["evidence", JSON.stringify([facts.OTHER, { ...facts.PROOF, ref: "doc-2" }])],
        ])
        expect(setOf(supported)).toEqual({ evidence: ":evidence::jsonb", updatedAt: "now()" })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(6)
    })

    it("rejects an unsupported proposal with no decision note when the note is blank", async () => {
        const em = mockEntityManager()
        const [, reject] = queueQueryBuilders(em, [
            { getMany: [facts.rowOf({ evidence: [facts.PROOF] })] },
            answered(facts.rowOf({ status: "rejected" })),
        ])
        await expect((await build(em)).withdrawSource(facts.WS, "doc-1", "  ")).resolves.toEqual([])
        expect(setOf(reject)).toMatchObject({ decidedBy: "NIVO", decisionNote: null })
    })

    it("refuses when a proposal it meant to reject was decided meanwhile", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [facts.rowOf({ evidence: [facts.PROOF] })] }, answered()])
        await expect((await build(em)).withdrawSource(facts.WS, "doc-1", "Removed")).rejects.toMatchObject({
            code: "BRAIN_FACTS_NOT_PROPOSED",
        })
    })
}

const registerMaintenance = () => {
    it("promotes due facts, supersedes every former value and counts expirations", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactEntity, [facts.rowOf(), facts.rowOf({ id: "f2" })]],
                [BrainFactEntity, [facts.rowOf({ id: "old1" }), facts.rowOf({ id: "old2" })]],
                [BrainFactEntity, []],
            ],
            update: [BrainFactEntity, { affected: 1 }],
        })
        const [promoted, , expire] = queueQueryBuilders(em, [
            answered(facts.rowOf({ status: "active" })),
            answered(),
            answered({ id: "e1" }, { id: "e2" }),
        ])
        await expect((await build(em)).maintain(facts.WS)).resolves.toEqual({
            activated: [facts.factOf({ status: "active" })],
            expired: 2,
        })
        expect(em.update.mock.calls.map((call): unknown => call[1])).toEqual([
            { workspaceId: facts.WS, id: "old1", status: "active" },
            { workspaceId: facts.WS, id: "old2", status: "active" },
        ])
        expect(promoted?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "scheduled" }]])
        expect(expire?.callsOf("returning")).toEqual([["id"]])
        expect(setOf(promoted)).toEqual({ status: "active", updatedAt: "now()" })
        expect(setOf(expire)).toEqual({ status: "expired", updatedAt: "now()" })
    })

    it("counts no expirations when the statement answers no rows", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, []] })
        queueQueryBuilders(em, [{ execute: {} }])
        await expect((await build(em)).maintain(facts.WS)).resolves.toEqual({ activated: [], expired: 0 })
    })
}

describe("BrainFactsMaintenanceService", () => {
    registerWithdraw()
    registerMaintenance()
})
