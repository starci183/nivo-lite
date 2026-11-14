import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ScopedTx } from "@modules/domain/entity-engine"
import {
    AGENT_RUNS,
    AGENT_RUN_STEPS,
    MemoryTables,
    memoryRunStore,
} from "@tests/fixtures/builders/engine-core-tables.builder"
import { runRecordOf, runRowOf, stepRecordOf, stepRowOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AGENT_RUN_TABLE_STORE } from "./agent-run-table-store.port"
import type { StoredRun, StoredStep } from "./agent-runs-rows.contracts"

const tx = mock<ScopedTx>({ workspaceId: "ws-1" })

/** The members of a stored row, as the table double keeps them. */
const dataOf = (row: StoredRun | StoredStep): Readonly<Record<string, unknown>> => {
    const { id: _id, workspaceId: _ws, version: _version, createdAt: _created, updatedAt: _updated, ...data } = row
    return data
}

const build = async () => {
    const tables = new MemoryTables()
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRunRecordsService, { provide: AGENT_RUN_TABLE_STORE, useValue: memoryRunStore(tables) }],
    }).compile()
    return { service: moduleRef.get(AgentRunRecordsService), tables }
}

describe("AgentRunRecordsService reads", () => {
    it("reads a run by id, or null", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUNS, "run-1", dataOf(runRowOf()))

        await expect(service.run(tx, "run-1")).resolves.toMatchObject({ id: "run-1", status: "running" })
        await expect(service.run(tx, "run-2")).resolves.toBeNull()
    })

    it("reads the run of a wake", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUNS, "run-1", dataOf(runRowOf()))

        await expect(service.runOfWake(tx, "wake-1")).resolves.toMatchObject({ wakeId: "wake-1" })
        await expect(service.runOfWake(tx, "wake-2")).resolves.toBeNull()
    })

    it("reads the steps of a run in order", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUN_STEPS, "s-2", dataOf(stepRowOf({ ordinal: 2, stepKey: "step-2" })))
        tables.put(AGENT_RUN_STEPS, "s-1", dataOf(stepRowOf()))
        tables.put(AGENT_RUN_STEPS, "s-9", dataOf(stepRowOf({ runId: "run-9", stepKey: "other" })))

        await expect(service.stepsOf(tx, "run-1")).resolves.toMatchObject([{ stepKey: "step-1" }, { stepKey: "step-2" }])
    })
})

describe("AgentRunRecordsService writes", () => {
    it("inserts a run, and none for a wake that holds one", async () => {
        const { service, tables } = await build()
        const run = { agentId: "agent-1", wakeId: "wake-1", trigger: "tag", graphVersionId: null, context: {} }

        await expect(service.insertRun(tx, run)).resolves.toMatchObject({ wakeId: "wake-1", status: "running", engine: "langgraph" })
        await expect(service.insertRun(tx, run)).resolves.toBeNull()
        expect(tables.of(AGENT_RUNS)).toHaveLength(1)
    })

    it("updates a run under the version read and answers the record after, null when stale", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUNS, "run-1", dataOf(runRowOf()))
        const read = runRecordOf({ version: "1" })

        await expect(service.patchRun(tx, read, { status: "done" })).resolves.toMatchObject({ status: "done", version: "2" })
        await expect(service.patchRun(tx, read, { status: "done" })).resolves.toBeNull()
    })

    it("updates a step the same way and refuses a write to a step that is gone", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUN_STEPS, "s-1", dataOf(stepRowOf()))

        await expect(service.patchStep(tx, stepRecordOf({ id: "s-1", version: "1" }), { status: "running" })).resolves.toMatchObject({
            version: "2",
        })
        await expect(service.patchStep(tx, stepRecordOf({ id: "s-404", version: "1" }), { status: "running" })).rejects.toMatchObject({
            code: "AGENT_RUNS_RESULT_REJECTED",
        })
    })
})

describe("AgentRunRecordsService: the engine of a run is read with it", () => {
    it("reads the engine of a run as its row names it", async () => {
        const { service, tables } = await build()
        tables.put(AGENT_RUNS, "run-1", dataOf(runRowOf({ engine: "langgraph" })))
        tables.put(AGENT_RUNS, "run-2", dataOf(runRowOf({ engine: "legacy", wakeId: "wake-2" })))

        await expect(service.run(tx, "run-1")).resolves.toMatchObject({ engine: "langgraph" })
        await expect(service.run(tx, "run-2")).resolves.toMatchObject({ engine: "legacy" })
    })
})

describe("AgentRunRecordsService.closeOpenSteps: the ONE closing every road that ends a run calls (E-FIX4)", () => {
    const AT = "2026-11-10T03:05:00.000Z"

    /** The shape seen twice on dev: a sale parked at `talk[r2].hear` inside its `talk` loop, both rows `running`, after the run ended. */
    const parkedSale = (tables: MemoryTables): void => {
        tables.put(AGENT_RUN_STEPS, "s-1", dataOf(stepRowOf({ stepKey: "talk[r1].consult", status: "done", ordinal: 2 })))
        tables.put(
            AGENT_RUN_STEPS,
            "s-2",
            dataOf(stepRowOf({ stepKey: "talk", status: "running", ordinal: 1, startedAt: "2026-11-10T03:00:00.000Z" })),
        )
        tables.put(
            AGENT_RUN_STEPS,
            "s-3",
            dataOf(stepRowOf({ stepKey: "talk[r2].hear", status: "running", ordinal: 3, waitItemId: "item-1", claimedUntil: AT })),
        )
        tables.put(AGENT_RUN_STEPS, "s-4", dataOf(stepRowOf({ stepKey: "later", status: "pending", ordinal: 4 })))
        tables.put(AGENT_RUN_STEPS, "s-9", dataOf(stepRowOf({ runId: "run-9", stepKey: "other", status: "running" })))
    }

    it("closes every open step (pending, running) of the run failed with the run's reason, gives back claim and wait, leaves done steps and other runs", async () => {
        const { service, tables } = await build()
        parkedSale(tables)

        await expect(service.closeOpenSteps(tx, "run-1", "subject_erased", AT)).resolves.toBe(3)

        const steps = await service.stepsOf(tx, "run-1")
        expect(steps.map((step) => [step.stepKey, step.status])).toEqual([
            ["talk", "failed"],
            ["talk[r1].consult", "done"],
            ["talk[r2].hear", "failed"],
            ["later", "failed"],
        ])
        expect((await service.stepRowsOf(tx, "run-1")).find((step) => step.stepKey === "talk")).toMatchObject({
            errorCode: "subject_erased",
            error: { code: "subject_erased" },
            endedAt: AT,
            durationMs: 300_000,
            claimedUntil: null,
            waitItemId: null,
        })
        expect((await service.stepRowsOf(tx, "run-1")).find((step) => step.stepKey === "talk[r2].hear")).toMatchObject({
            waitItemId: null,
            claimedUntil: null,
            durationMs: null,
        })
        expect((await service.stepRowsOf(tx, "run-9"))[0]?.status).toBe("running")
    })

    it("is idempotent: a second call closes nothing and writes nothing", async () => {
        const { service, tables } = await build()
        parkedSale(tables)
        await service.closeOpenSteps(tx, "run-1", "subject_erased", AT)
        const before = await service.stepRowsOf(tx, "run-1")

        await expect(service.closeOpenSteps(tx, "run-1", "run_cancelled", "2026-11-10T04:00:00.000Z")).resolves.toBe(0)
        expect(await service.stepRowsOf(tx, "run-1")).toEqual(before)
    })
})
