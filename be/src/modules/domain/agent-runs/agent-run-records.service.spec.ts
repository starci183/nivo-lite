import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, Query } from "@nivo-lite/agent-sdk/query"
import { agentRunEntity, agentRunStepEntity } from "@nivo-lite/blocks-core/entities"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { runRecordOf, runRowOf, stepRecordOf, stepRowOf } from "@tests/fixtures/builders/agent-runs.builder"

const tx = mock<ScopedTx>({ workspaceId: "ws-1" })

const page = (rows: ReadonlyArray<ReturnType<typeof runRowOf>>) => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next: null,
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunRecordsService), engine, mutations }
}

const queryOf = (engine: ReturnType<typeof mock<EntityEngineService>>): Query => {
    const call = engine.list.mock.calls.at(-1)
    if (call === undefined) throw new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })
    return call[1]
}

describe("AgentRunRecordsService reads", () => {
    it("reads a run by id, or null", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValueOnce(runRowOf()).mockResolvedValueOnce(null)

        await expect(service.run(tx, "run-1")).resolves.toMatchObject({ id: "run-1", status: "running" })
        await expect(service.run(tx, "run-2")).resolves.toBeNull()
        expect(engine.get).toHaveBeenCalledWith(tx, "agent.run", "run-1")
    })

    it("reads the run of a wake through the wake index", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValueOnce(page([runRowOf()])).mockResolvedValueOnce(page([]))

        await expect(service.runOfWake(tx, "wake-1")).resolves.toMatchObject({ wakeId: "wake-1" })
        expect(queryOf(engine)).toMatchObject({
            from: "agent.run",
            where: { op: "eq", field: "wakeId", value: "wake-1" },
            order: [["id", "asc"]],
        })
        await expect(service.runOfWake(tx, "wake-2")).resolves.toBeNull()
    })

    it("lists the runs of a status, narrowed by a filter when given", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(page([runRowOf({ status: "parked" })]))

        await service.runsOf(tx, "parked", null, [["id", "asc"]], 5)
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "status", value: "parked" })
        const runs = await service.runsOf(tx, "parked", { op: "notNull", field: "endedAt" }, [["id", "asc"]], 5)

        expect(runs).toHaveLength(1)
        expect(queryOf(engine).where).toEqual({
            op: "and",
            of: [
                { op: "eq", field: "status", value: "parked" },
                { op: "notNull", field: "endedAt" },
            ],
        })
    })

    it("reads the steps of a run in order, and the steps of a status, a wait and a link", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(page([stepRowOf()]))

        await expect(service.stepsOf(tx, "run-1")).resolves.toHaveLength(1)
        expect(queryOf(engine).order).toEqual([
            ["ordinal", "asc"],
            ["id", "asc"],
        ])
        await expect(service.stepsOfStatus(tx, "running", null, [["id", "asc"]], 3)).resolves.toHaveLength(1)
        await expect(service.stepsWaitingOn(tx, "item-1")).resolves.toHaveLength(1)
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "waitItemId", value: "item-1" })
        await expect(service.stepsAbout(tx, "approval", "item-1", 2)).resolves.toHaveLength(1)
        expect(queryOf(engine).page).toEqual({ size: 2 })
    })
})

describe("AgentRunRecordsService writes", () => {
    it("inserts a run and a step linked to its run", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValue({ ok: true, row: runRowOf(), version: "1" })

        await service.insertRun(tx, { status: "running" })
        await service.insertStep(tx, "run-1", { ordinal: 1 })

        expect(mutations.mutate).toHaveBeenNthCalledWith(
            1,
            tx,
            { op: "insert", entity: "agent.run", values: { status: "running" } },
            "job",
        )
        expect(mutations.mutate).toHaveBeenNthCalledWith(
            2,
            tx,
            { op: "insert", entity: "agent.run-step", values: { ordinal: 1, runId: "run-1" }, links: { run: "run-1" } },
            "job",
        )
    })

    it("updates a run under the version read and answers the record after, null when stale", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce({ ok: true, row: runRowOf({ status: "done" }, "run-1", "4"), version: "4" })
            .mockResolvedValueOnce({ ok: false, reason: "stale" })

        await expect(service.patchRun(tx, runRecordOf(), { status: "done" })).resolves.toMatchObject({
            status: "done",
            version: "4",
        })
        await expect(service.patchRun(tx, runRecordOf(), { status: "done" })).resolves.toBeNull()
        expect(mutations.mutate).toHaveBeenCalledWith(
            tx,
            { op: "update", entity: "agent.run", key: "run-1", expected: "3", values: { status: "done" } },
            "job",
        )
    })

    it("updates a step the same way and refuses any other refusal", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce({ ok: true, row: stepRowOf({ status: "running" }, "s-1", "3"), version: "3" })
            .mockResolvedValueOnce({ ok: false, reason: "missing" })

        await expect(service.patchStep(tx, stepRecordOf(), { status: "running" })).resolves.toMatchObject({
            version: "3",
        })
        await expect(service.patchStep(tx, stepRecordOf(), { status: "running" })).rejects.toMatchObject({
            code: "AGENT_RUNS_RESULT_REJECTED",
        })
    })
})

describe("AgentRunRecordsService: the engine of a run is read with it, and every list stays index-served", () => {
    it("reads the engine of a run (legacy when the row names none)", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValueOnce(runRowOf({ engine: "langgraph" })).mockResolvedValueOnce(runRowOf())

        await expect(service.run(tx, "run-1")).resolves.toMatchObject({ engine: "langgraph" })
        await expect(service.run(tx, "run-1")).resolves.toMatchObject({ engine: "legacy" })
    })

    it("selects the engine in the run lists the sweep and the park pass read, and the real validator finds no problem", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(page([]))
        await service.runOfWake(tx, "wake-1")
        await service.runsOf(tx, "parked", null, [["resumeNotBefore", "asc"], ["id", "asc"]], 10)
        await service.stepsOfStatus(tx, "running", { op: "notNull", field: "waitItemId" }, [["claimedUntil", "asc"], ["id", "asc"]], 5)

        const catalog: EntityCatalog = new Map<string, EntityDefinition>([
            [agentRunEntity.name, agentRunEntity],
            [agentRunStepEntity.name, agentRunStepEntity],
        ])
        const queries = engine.list.mock.calls.map(([, query]) => query)
        expect(queries[0]?.select).toContain("engine")
        expect(queries.flatMap((query) => queryProblems(query, catalog))).toEqual([])
    })
})
