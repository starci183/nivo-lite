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
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const reads = mock<BrainFactsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsMaintenanceService,
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
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

        await expect(
            service.withdrawChanged(facts.WS, "doc-1", "Changed", { hashes: [], folded: "open from 8 to 21 daily" }),
        ).resolves.toEqual({
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
        expect(setOf(promoted)).toEqual({
            status: "active",
            version: 1,
            validTo: "coalesce(valid_to, coalesce(valid_from, now()) + interval '1 year')",
        })
        expect(setOf(expire)).toEqual({ status: "expired" })
    })

    it("FX5: a scheduled replacement ends the fact its approval named when it starts, even of another key (never two in force)", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [facts.rowOf({ id: "new", status: "scheduled", supersedesId: "old" })]],
            update: [BrainFactEntity, { affected: 1 }],
        })
        const { service, reads } = await build(em)
        // Nothing active under the new fact's own key and scope: the replaced value is only reachable by the name its approval kept.
        reads.keyed.mockResolvedValue([])
        reads.fetch.mockResolvedValue(
            facts.factOf({ id: "old", status: "active", version: 1, subjectKey: "giao-hang-noi-thanh" }),
        )
        const [promoted] = queueQueryBuilders(em, [answered(facts.rowOf({ id: "new", status: "active" })), answered()])

        await service.maintain(facts.WS)

        expect(reads.fetch).toHaveBeenCalledWith(em, facts.WS, "old")
        expect(em.update.mock.calls.map((call): unknown => call[1])).toEqual([
            { workspaceId: facts.WS, id: "old", status: "active" },
        ])
        expect(setOf(promoted)).toMatchObject({ status: "active", version: 2 })
    })

    it("FX5: a named fact that is no longer active is not touched again; the key's own value is", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [facts.rowOf({ id: "new", status: "scheduled", supersedesId: "gone" })]],
            update: [BrainFactEntity, { affected: 1 }],
        })
        const { service, reads } = await build(em)
        reads.keyed.mockResolvedValue([facts.factOf({ id: "keyed", status: "active" })])
        reads.fetch.mockResolvedValue(facts.factOf({ id: "gone", status: "expired" }))
        queueQueryBuilders(em, [answered(facts.rowOf({ id: "new", status: "active" })), answered()])

        await service.maintain(facts.WS)

        expect(em.update.mock.calls.map((call): unknown => call[1])).toEqual([
            { workspaceId: facts.WS, id: "keyed", status: "active" },
        ])
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

describe("BrainFactsMaintenanceService withdraw by chunk hash", () => {
    it("moves only the facts born from the changed chunk: the others are not even written", async () => {
        const em = mockEntityManager()
        const hours = { ...facts.PROOF, chunkHash: "h-hours", quote: "Open 8" }
        const ship = { ...facts.PROOF, chunkHash: "h-ship", quote: "Ship 20.000" }
        const [, orphanWrite] = queueQueryBuilders(em, [
            {
                getMany: [
                    facts.rowOf({ id: "hours", status: "active", sourceKind: "document", evidence: [hours] }),
                    facts.rowOf({ id: "ship", status: "active", sourceKind: "document", evidence: [ship] }),
                ],
            },
            { execute: {} },
        ])
        const service = (await build(em)).service

        await expect(
            service.withdrawChanged(facts.WS, "doc-1", "Changed", { hashes: ["h-hours"], folded: "" }),
        ).resolves.toEqual({ orphans: ["ship"], withdrawn: 1 })
        expect(orphanWrite?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "ship" }]])
        expect(orphanWrite?.callsOf("setParameter")).toEqual([["evidence", "[]"]])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
    })
})
