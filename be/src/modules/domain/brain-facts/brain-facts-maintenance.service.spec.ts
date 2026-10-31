import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const reads = mock<BrainFactsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsMaintenanceService,
            { provide: BrainFactsReadService, useValue: reads },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { service: moduleRef.get(BrainFactsMaintenanceService), reads }
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
        await expect((await build(em)).service.withdrawSource(facts.WS, "doc-1", "Removed")).resolves.toEqual([
            "orphan",
        ])
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
        expect(setOf(supported)).toEqual({ evidence: ":evidence::jsonb" })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(6)
    })

    it("leaves a fact resting on the unchanged text and counts what it took", async () => {
        const em = mockEntityManager()
        const quoted = { ...facts.PROOF, quote: "Open from 8 to 21" }
        const [, reject] = queueQueryBuilders(em, [
            { getMany: [facts.rowOf({ evidence: [quoted] }), facts.rowOf({ id: "gone", evidence: [facts.PROOF] })] },
            { execute: { raw: [facts.rowOf({ id: "gone", status: "rejected" })] } },
        ])
        const service = (await build(em)).service

        await expect(service.withdrawChanged(facts.WS, "doc-1", "Changed", "open from 8 to 21 daily")).resolves.toEqual({
            orphans: [],
            withdrawn: 1,
        })
        expect(reject?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "gone", status: "proposed" }]])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
    })

    it("rejects an unsupported proposal with no decision note when the note is blank", async () => {
        const em = mockEntityManager()
        const [, reject] = queueQueryBuilders(em, [
            { getMany: [facts.rowOf({ evidence: [facts.PROOF] })] },
            answered(facts.rowOf({ status: "rejected" })),
        ])
        await expect((await build(em)).service.withdrawSource(facts.WS, "doc-1", "  ")).resolves.toEqual([])
        expect(setOf(reject)).toMatchObject({ decidedBy: "NIVO", decisionNote: null })
    })

    it("refuses when a proposal it meant to reject was decided meanwhile", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [facts.rowOf({ evidence: [facts.PROOF] })] }, answered()])
        await expect((await build(em)).service.withdrawSource(facts.WS, "doc-1", "Removed")).rejects.toMatchObject({
            code: "BRAIN_FACTS_NOT_PROPOSED",
        })
    })
}

const registerMaintenance = () => {
    it("promotes due facts, supersedes every former value and counts expirations", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [facts.rowOf(), facts.rowOf({ id: "f2" })]],
            update: [BrainFactEntity, { affected: 1 }],
        })
        const { service, reads } = await build(em)
        reads.keyed
            .mockResolvedValueOnce([facts.factOf({ id: "old1" }), facts.factOf({ id: "old2" })])
            .mockResolvedValue([])
        const [promoted, , expire] = queueQueryBuilders(em, [
            answered(facts.rowOf({ status: "active" })),
            answered(),
            answered({ id: "e1" }, { id: "e2" }),
        ])
        await expect(service.maintain(facts.WS)).resolves.toEqual({
            activated: [facts.factOf({ status: "active" })],
            expired: 2,
        })
        expect(em.update.mock.calls.map((call): unknown => call[1])).toEqual([
            { workspaceId: facts.WS, id: "old1", status: "active" },
            { workspaceId: facts.WS, id: "old2", status: "active" },
        ])
        expect(promoted?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "scheduled" }]])
        expect(expire?.callsOf("returning")).toEqual([["id"]])
        expect(setOf(promoted)).toEqual({ status: "active" })
        expect(setOf(expire)).toEqual({ status: "expired" })
    })

    it("counts no expirations when the statement answers no rows", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, []] })
        queueQueryBuilders(em, [{ execute: {} }])
        await expect((await build(em)).service.maintain(facts.WS)).resolves.toEqual({ activated: [], expired: 0 })
    })
}

describe("BrainFactsMaintenanceService", () => {
    registerWithdraw()
    registerMaintenance()
})
