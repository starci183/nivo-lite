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

    it("reads the steps of a run in order", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(page([stepRowOf()]))

        await expect(service.stepsOf(tx, "run-1")).resolves.toHaveLength(1)
        expect(queryOf(engine).order).toEqual([
            ["ordinal", "asc"],
            ["id", "asc"],
        ])
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "runId", value: "run-1" })
    })
})

describe("AgentRunRecordsService writes", () => {
    it("inserts a run", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValue({ ok: true, row: runRowOf(), version: "1" })

        await service.insertRun(tx, { status: "running" })

        expect(mutations.mutate).toHaveBeenCalledWith(
            tx,
            { op: "insert", entity: "agent.run", values: { status: "running" } },
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

    it("selects the engine in the run lists, and the real validator finds no problem in any list it reads", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(page([]))
        await service.runOfWake(tx, "wake-1")
        await service.runsOfAgent(tx, "agent-1", 20)
        await service.stepsOf(tx, "run-1")
        await service.stepRowsOf(tx, "run-1")

        const catalog: EntityCatalog = new Map<string, EntityDefinition>([
            [agentRunEntity.name, agentRunEntity],
            [agentRunStepEntity.name, agentRunStepEntity],
        ])
        const queries = engine.list.mock.calls.map(([, query]) => query)
        expect(queries[0]?.select).toContain("engine")
        expect(queries.flatMap((query) => queryProblems(query, catalog))).toEqual([])
    })
})
