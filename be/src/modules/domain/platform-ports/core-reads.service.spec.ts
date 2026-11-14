import { mock } from "@starci/jest-preset"
import { AgentRunRecordsService } from "@modules/domain/agent-runs"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { AGENT_RUNS, MemoryTables, RUN_DEFAULTS, memoryRunStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import { CoreReadsService } from "./core-reads.service"

/**
 * The core read of the runs the desk lists (`platform.agent-runs`, `platform.agent-run-counts`) over the run store as its rows stand
 * (E-FIX4, RESTART-R3 row f): a sale parked at a `wait` is STORED `running` with its wait mark, and is REPORTED `waiting`; a run a
 * person skipped or an erasure ended is `cancelled`, as stored.
 */
const AGENT = "agent-1"

/** One run row of the agent: a status, a wait mark or none, a start (newest first in the list). */
const runOf = (tables: MemoryTables, id: string, status: string, startedAt: string, waitMatch: ReadonlyArray<string> | null = null): void => {
    tables.put(AGENT_RUNS, id, {
        ...RUN_DEFAULTS,
        agentId: AGENT,
        wakeId: `wake-${id}`,
        trigger: "zalo.message.received",
        graphVersionId: null,
        context: {},
        status,
        startedAt,
        waitMatch: waitMatch === null ? null : [...waitMatch],
    })
}

const build = (): { core: ReturnType<CoreReadsService["portFor"]>; tables: MemoryTables } => {
    const tables = new MemoryTables()
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const service = new CoreReadsService(engine, new AgentRunRecordsService(memoryRunStore(tables)), mock<InstallationRecordsService>())
    // The dev board of RESTART-R3/R4: a consult parked at `talk[r2].hear`, a front desk running a step, a skipped run, a done one.
    runOf(tables, "run-parked", "running", "2026-11-14T05:05:00.000Z", ["route:route-1"])
    runOf(tables, "run-step", "running", "2026-11-14T05:04:00.000Z")
    runOf(tables, "run-skipped", "cancelled", "2026-11-14T05:03:00.000Z")
    runOf(tables, "run-stop", "waiting", "2026-11-14T05:02:00.000Z")
    runOf(tables, "run-done", "done", "2026-11-14T05:01:00.000Z")
    return { core: service.portFor("ws-1"), tables }
}

describe("CoreReadsService: a run is reported in its REPORTED status (parked at a wait = waiting; cancelled = cancelled)", () => {
    it("lists every run with its reported status, newest first", async () => {
        const { core } = build()

        const page = await core.runs.list({ agent: AGENT, order: "started", size: 10 })

        expect(page.rows.map((run) => [run.id, run.status])).toEqual([
            ["run-parked", "waiting"],
            ["run-step", "running"],
            ["run-skipped", "cancelled"],
            ["run-stop", "waiting"],
            ["run-done", "done"],
        ])
        expect(page.rows[0]?.trigger).toBe("zalo.message.received")
    })

    it("narrows by reported status: `waiting` holds the run parked at a wait and the stop; `running` only the run in a step", async () => {
        const { core } = build()

        const waiting = await core.runs.list({ agent: AGENT, statuses: ["waiting"], order: "started", size: 10 })
        const running = await core.runs.list({ agent: AGENT, statuses: ["running"], order: "started", size: 10 })
        const cancelled = await core.runs.list({ agent: AGENT, statuses: ["cancelled"], order: "started", size: 10 })

        expect(waiting.rows.map((run) => run.id)).toEqual(["run-parked", "run-stop"])
        expect(running.rows.map((run) => [run.id, run.status])).toEqual([["run-step", "running"]])
        expect(cancelled.rows.map((run) => run.id)).toEqual(["run-skipped"])
    })

    it("reads one run in its reported status", async () => {
        const { core } = build()

        await expect(core.runs.get("run-parked")).resolves.toMatchObject({ status: "waiting" })
        await expect(core.runs.get("run-step")).resolves.toMatchObject({ status: "running" })
        await expect(core.runs.get("run-none")).resolves.toBeNull()
    })

    it("counts by reported status: the run parked at a wait moves from running to waiting; a status asked narrows", async () => {
        const { core } = build()

        const all = await core.runs.count(AGENT)
        expect(Object.fromEntries(all.map((group) => [group.status, group.count]))).toEqual({
            running: 1,
            waiting: 2,
            cancelled: 1,
            done: 1,
        })
        await expect(core.runs.count(AGENT, ["running"])).resolves.toEqual([{ status: "running", count: 1 }])
    })
})
