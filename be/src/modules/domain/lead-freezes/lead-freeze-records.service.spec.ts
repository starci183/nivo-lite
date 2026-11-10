import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { SCOPE, pageOf, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { LeadFreezesError, LeadFreezesErrorCode } from "./errors/lead-freezes.error"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { freezeOf } from "./lead-freezes.mapper"
import type { LeadFreeze } from "./lead-freezes.contracts"

const rowOf = (id: string, data: RecordRow["data"], version = "2"): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version,
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
    data,
})

const FREEZE_ROW = rowOf("freeze-1", {
    key: "lead:lead-1",
    leadId: "lead-1",
    conversationId: "c-1",
    status: "frozen",
    frozenRunId: "run-1",
    episode: 1,
    failures: 1,
    pending: { events: [] },
})

const written = (row: RecordRow): EngineResult => ({ ok: true, row, version: row.version })

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const mutations = mock<EntityMutationService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeRecordsService), engine, mutations }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof LeadFreezesError ? cause.code : cause
    }
}

describe("LeadFreezeRecordsService reads", () => {
    it("finds a freeze by its key, its run and its lead through declared indexes, and by its id", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([FREEZE_ROW]))
        engine.get.mockResolvedValue(FREEZE_ROW)

        await expect(service.byKey("ws-1", "lead:lead-1")).resolves.toMatchObject({ id: "freeze-1", status: "frozen" })
        await expect(service.byRun("ws-1", "run-1")).resolves.toMatchObject({ frozenRunId: "run-1" })
        await expect(service.byLead("ws-1", "lead-1")).resolves.toMatchObject({ leadId: "lead-1" })
        await expect(service.byId("ws-1", "freeze-1")).resolves.toMatchObject({ key: "lead:lead-1" })

        const wheres = engine.list.mock.calls.map((call) => call[1].where)
        expect(wheres).toEqual([
            { op: "eq", field: "key", value: "lead:lead-1" },
            { op: "eq", field: "frozenRunId", value: "run-1" },
            { op: "eq", field: "leadId", value: "lead-1" },
        ])
        expect(engine.list.mock.calls[0]?.[1]).toMatchObject({
            from: "agent.lead-freeze",
            order: [["id", "asc"]],
            page: { size: 1 },
        })
    })

    it("answers null for a freeze that is not there, and joins the caller's transaction when given one", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))
        engine.get.mockResolvedValue(null)
        const manager = mockEntityManager()

        await expect(service.byKey("ws-1", "lead:x", manager)).resolves.toBeNull()
        await expect(service.byId("ws-1", "x")).resolves.toBeNull()
        expect(engine.within).toHaveBeenCalledWith(manager, "ws-1", expect.any(Function))
    })

    it("lists the customers frozen or retried, oldest first, by the status index", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValueOnce(pageOf([FREEZE_ROW])).mockResolvedValueOnce(pageOf([]))

        await expect(service.holding("ws-1")).resolves.toHaveLength(1)

        expect(engine.list.mock.calls.map((call) => call[1].where)).toEqual([
            { op: "eq", field: "status", value: "frozen" },
            { op: "eq", field: "status", value: "retrying" },
        ])
        expect(engine.list.mock.calls[0]?.[1].order).toEqual([
            ["frozenAt", "asc"],
            ["id", "asc"],
        ])
    })
})

describe("LeadFreezeRecordsService reads of the other capabilities", () => {
    it("reads the lead of a conversation and the name of a lead", async () => {
        const { service, engine } = await build()
        engine.get
            .mockResolvedValueOnce(rowOf("c-1", { leadId: "lead-1" }))
            .mockResolvedValueOnce(rowOf("lead-1", { contactName: "A" }))
        await expect(service.leadOfConversation("ws-1", "c-1")).resolves.toBe("lead-1")
        await expect(service.nameOfLead("ws-1", "lead-1")).resolves.toBe("A")
        engine.get.mockResolvedValue(null)
        await expect(service.leadOfConversation("ws-1", "c-2")).resolves.toBeNull()
    })

    it("finds the frozen customer a transfer pays by the transfer code of their orders", async () => {
        const { service, engine } = await build()
        const freeze: LeadFreeze = freezeOf(FREEZE_ROW)
        const other: LeadFreeze = { ...freeze, id: "freeze-2", leadId: "lead-2" }
        const noLead: LeadFreeze = { ...freeze, id: "freeze-3", leadId: null }
        engine.get.mockResolvedValue(rowOf("tx-1", { reference: "DH202611090001 chuyen khoan" }))
        engine.list
            .mockResolvedValueOnce(pageOf([rowOf("o-9", { orderNo: "DH-20261109-0009" })]))
            .mockResolvedValueOnce(pageOf([rowOf("o-1", { orderNo: "DH-20261109-0001" })]))

        await expect(service.leadOfTransaction("ws-1", "tx-1", [noLead, other, freeze])).resolves.toMatchObject({
            id: "freeze-1",
        })
        expect(engine.list.mock.calls.map((call) => call[1].where)).toEqual([
            { op: "eq", field: "leadId", value: "lead-2" },
            { op: "eq", field: "leadId", value: "lead-1" },
        ])
        expect(engine.list.mock.calls[0]?.[1]).toMatchObject({
            from: "sales.order",
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
        })

        engine.get.mockResolvedValue(rowOf("tx-2", { reference: null }))
        await expect(service.leadOfTransaction("ws-1", "tx-2", [freeze])).resolves.toBeNull()
        engine.get.mockResolvedValue(rowOf("tx-3", { reference: "nothing" }))
        engine.list.mockResolvedValue(pageOf([rowOf("o-1", { orderNo: "DH-20261109-0001" })]))
        await expect(service.leadOfTransaction("ws-1", "tx-3", [freeze])).resolves.toBeNull()
    })
})

describe("LeadFreezeRecordsService writes", () => {
    it("ensures one freeze per customer key, and finds the one a racer wrote first", async () => {
        const { service, engine, mutations } = await build()
        mutations.mutate.mockResolvedValueOnce(written(FREEZE_ROW))
        const subject = { key: "lead:lead-1", leadId: "lead-1", conversationId: "c-1" }

        await expect(service.ensure("ws-1", subject, { status: "released", pending: [] })).resolves.toMatchObject({
            id: "freeze-1",
        })
        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            {
                op: "ensure",
                entity: "agent.lead-freeze",
                match: "key",
                values: {
                    status: "released",
                    pending: { events: [] },
                    key: "lead:lead-1",
                    leadId: "lead-1",
                    conversationId: "c-1",
                },
            },
            "job",
        )

        mutations.mutate.mockResolvedValueOnce({
            ok: false,
            reason: "taken",
            constraint: "freeze_key",
            refusal: "lead-freeze-taken",
        })
        engine.list.mockResolvedValueOnce(pageOf([FREEZE_ROW]))
        await expect(service.ensure("ws-1", subject, {})).resolves.toMatchObject({ id: "freeze-1" })

        mutations.mutate.mockResolvedValueOnce({ ok: false, reason: "invalid" })
        engine.list.mockResolvedValueOnce(pageOf([]))
        await expect(codeOf(service.ensure("ws-1", subject, {}))).resolves.toBe(LeadFreezesErrorCode.RecordUnreadable)
    })
})

describe("LeadFreezeRecordsService writes under the version read", () => {
    it("patches under the version read, builds again after another writer moved the freeze, and writes nothing on a null build", async () => {
        const { service, engine, mutations } = await build()
        engine.get.mockResolvedValueOnce(FREEZE_ROW).mockResolvedValueOnce(rowOf("freeze-1", FREEZE_ROW.data, "3"))
        mutations.mutate
            .mockResolvedValueOnce({ ok: false, reason: "stale" })
            .mockResolvedValueOnce(written(rowOf("freeze-1", { ...FREEZE_ROW.data, status: "retrying" }, "4")))
        const versions: Array<string> = []

        const patched = await service.patch("ws-1", "freeze-1", (freeze) => {
            versions.push(freeze.version)
            return { status: "retrying" }
        })

        expect(patched).toMatchObject({ status: "retrying", version: "4" })
        expect(versions).toEqual(["2", "3"])
        expect(mutations.mutate.mock.calls[1]?.[1]).toEqual({
            op: "update",
            entity: "agent.lead-freeze",
            key: "freeze-1",
            expected: "3",
            values: { status: "retrying" },
        })

        engine.get.mockResolvedValueOnce(FREEZE_ROW)
        await expect(service.patch("ws-1", "freeze-1", () => null)).resolves.toBeNull()
    })

    it("refuses a freeze that is gone, a write the engine rejects, and one that keeps losing the race", async () => {
        const { service, engine, mutations } = await build()
        engine.get.mockResolvedValueOnce(null)
        await expect(codeOf(service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.RecordUnreadable,
        )
        engine.get.mockResolvedValueOnce(FREEZE_ROW)
        mutations.mutate.mockResolvedValueOnce({ ok: false, reason: "invalid" })
        await expect(codeOf(service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.RecordUnreadable,
        )
        engine.get.mockResolvedValue(FREEZE_ROW)
        mutations.mutate.mockResolvedValue({ ok: false, reason: "stale" })
        await expect(codeOf(service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.Contended,
        )
    })
})
