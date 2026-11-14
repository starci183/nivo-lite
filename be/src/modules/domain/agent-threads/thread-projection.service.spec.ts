import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { AgentRunRecordsService, type AgentRunTableStore, type StepSpec, type StoredRun, type StoredStep } from "@modules/domain/agent-runs"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import {
    AGENT_RUNS,
    AGENT_RUN_STEPS,
    RUN_DEFAULTS,
    STEP_DEFAULTS,
} from "@tests/fixtures/builders/engine-core-tables.builder"
import { ThreadProjectionService } from "./thread-projection.service"
import type {
    ThreadRunRefParams,
    ThreadStepCallParams,
    ThreadStepEndParams,
    ThreadStepFactParams,
    ThreadStepParams,
    ThreadStepStopParams,
} from "./thread-projection.contracts"

const RUN = AGENT_RUNS
const STEP = AGENT_RUN_STEPS
const REF: ThreadRunRefParams = { workspaceId: "ws-1", runId: "run-1" }
const T0 = new Date("2026-11-10T10:00:00.000Z")
const at = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000)

/** The runs and steps tables as the run store keeps them: rows by id, every row a copy, a version that moves on each write. */
class Store {
    readonly rows = new Map<string, { entity: string; row: RecordRow }>()
    writes = 0
    private next = 0
    /** Moves a row's version once before the next update of that entity: another writer won the race. */
    raceOn: string | null = null

    put(entity: string, id: string, data: Record<string, unknown>): void {
        this.rows.set(id, { entity, row: this.rowOf(id, "1", data) })
    }

    get(entity: string, id: string): RecordRow | null {
        const held = this.rows.get(id)
        return held?.entity === entity ? held.row : null
    }

    stepsOf(runId: unknown): ReadonlyArray<RecordRow> {
        return [...this.rows.values()]
            .filter((held) => held.entity === STEP && held.row.data.runId === runId)
            .map((held) => held.row)
            .toSorted((a, b) => Number(a.data.ordinal) - Number(b.data.ordinal))
    }

    mutate(mutation: Mutation): EngineResult {
        if (mutation.op === "insert") return this.insert(mutation.entity, mutation.values)
        if (mutation.op !== "update") return { ok: false, reason: "invalid" }
        const held = this.rows.get(mutation.key)
        if (held === undefined) return { ok: false, reason: "missing" }
        if (this.raceOn === mutation.entity) {
            this.raceOn = null
            held.row = this.rowOf(held.row.id, String(Number(held.row.version) + 1), held.row.data)
        }
        if (mutation.expected !== held.row.version) return { ok: false, reason: "stale" }
        const version = String(Number(held.row.version) + 1)
        held.row = this.rowOf(held.row.id, version, { ...held.row.data, ...mutation.values })
        this.writes += 1
        return { ok: true, row: held.row, version }
    }

    private insert(entity: string, values: Readonly<Record<string, unknown>>): EngineResult {
        const taken = this.stepsOf(values.runId).some((row) => row.data.stepKey === values.stepKey)
        if (entity === STEP && taken)
            return { ok: false, reason: "taken", constraint: "run_step_key", refusal: "step-already-written" }
        this.next += 1
        const row = this.rowOf(`step-${this.next}`, "1", values)
        this.writes += 1
        this.rows.set(row.id, { entity, row })
        return { ok: true, row, version: "1" }
    }

    private rowOf(id: string, version: string, data: Readonly<Record<string, unknown>>): RecordRow {
        const stamp = T0.toISOString()
        return { id, workspaceId: "ws-1", version, createdAt: stamp, updatedAt: stamp, data: structuredClone(data) }
    }
}

const openRun = (store: Store, over: Record<string, unknown> = {}): void =>
    store.put(RUN, "run-1", {
        engine: "legacy",
        agentId: "agent-1",
        wakeId: "wake-1",
        trigger: "tag",
        graphVersionId: "v-1",
        planning: false,
        status: "running",
        context: {},
        error: null,
        stepSeq: 0,
        resumeAttempts: 0,
        startedAt: T0.toISOString(),
        endedAt: null,
        ...over,
    })

/** A run row as the run store hands it out: a column the row does not hold reads its default. */
const runOf = (row: RecordRow): StoredRun => ({
    ...RUN_DEFAULTS,
    startedAt: row.createdAt,
    ...(structuredClone(row.data) as Partial<StoredRun>),
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
} as StoredRun)

/** A step row as the run store hands it out. */
const stepOf = (row: RecordRow): StoredStep => ({
    ...STEP_DEFAULTS,
    ...(structuredClone(row.data) as Partial<StoredStep>),
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
} as StoredStep)

/** A write of the run store as the tables keep it: a JSON copy. */
const jsonValues = (values: object): MutationValues => structuredClone({ ...values }) as MutationValues

const writtenOf = <T>(result: EngineResult, read: (row: RecordRow) => T): T | null => (result.ok ? read(result.row) : null)

/** The run store over the tables, as far as the projection reads and writes it. */
const tableOf = (store: Store): AgentRunTableStore => {
    const table = mock<AgentRunTableStore>()
    table.run.mockImplementation((_tx, id) => {
        const row = store.get(RUN, id)
        return Promise.resolve(row === null ? null : runOf(row))
    })
    table.steps.mockImplementation((_tx, runId) => Promise.resolve(store.stepsOf(runId).map(stepOf)))
    table.insertStep.mockImplementation((_tx, values) =>
        Promise.resolve(writtenOf(store.mutate({ op: "insert", entity: STEP, values: jsonValues(values) }), stepOf)),
    )
    table.patchRun.mockImplementation((_tx, id, fence, values) =>
        Promise.resolve(writtenOf(store.mutate({ op: "update", entity: RUN, key: id, expected: fence, values: jsonValues(values) }), runOf)),
    )
    table.patchStep.mockImplementation((_tx, id, fence, values) =>
        Promise.resolve(writtenOf(store.mutate({ op: "update", entity: STEP, key: id, expected: fence, values: jsonValues(values) }), stepOf)),
    )
    return table
}

const build = async (store: Store): Promise<ThreadProjectionService> => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadProjectionService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: new AgentRunRecordsService(tableOf(store)) },
        ],
    }).compile()
    return moduleRef.get(ThreadProjectionService)
}

const specOf = (key: string): StepSpec => ({
    stepKey: key,
    nodeKey: key,
    kind: "graph_node",
    effect: { kind: "write" },
    input: { versionId: "v-1", nodeKey: key, trigger: { text: "hi" }, skipped: undefined },
})

const step = (key: string, ordinal: number, attempt: number, seconds: number): ThreadStepParams => ({
    spec: specOf(key),
    ordinal,
    attempt,
    at: at(seconds),
})

const CALLS: ReadonlyArray<ThreadStepCallParams> = [
    { tool: "nivo.tool.customer.message.send", ok: true, failure: null, effectKey: "call:run-1:reply:abc" },
]

const ended = (key: string, ordinal: number, attempt: number, seconds: number): ThreadStepEndParams => ({
    ...step(key, ordinal, attempt, seconds),
    result: { output: { said: true }, effects: [] },
    calls: CALLS,
    code: null,
    workItemId: null,
})

const stopped = (key: string, ordinal: number, attempt: number, seconds: number): ThreadStepStopParams => ({
    ...step(key, ordinal, attempt, seconds),
    code: "ai_confused",
    error: { reason: "two addresses" },
    calls: CALLS,
    waitItemId: null,
})

/** Every row of the run and its steps, without the ids and versions a write moves. */
const rowsOf = (store: Store): unknown => ({
    run: store.get(RUN, "run-1")?.data,
    steps: store.stepsOf("run-1").map((row) => row.data),
})

describe("ThreadProjectionService", () => {
    it("marks the run as a thread's once, and answers missing for a run that is not there", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await expect(service.runStarted(REF)).resolves.toBe("written")
        await expect(service.runStarted(REF)).resolves.toBe("kept")
        expect(store.get(RUN, "run-1")?.data.engine).toBe("langgraph")
        await expect(service.runStarted({ workspaceId: "ws-1", runId: "run-9" })).resolves.toBe("missing")
        await expect(service.stepStarted({ workspaceId: "ws-1", runId: "run-9" }, step("a", 1, 1, 0))).resolves.toBe(
            "missing",
        )
    })

    it("writes one row per step: a replayed start, end or late start keeps it, with the first moments of the try", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await expect(service.stepStarted(REF, step("greet", 1, 1, 0))).resolves.toBe("written")
        await expect(service.stepStarted(REF, step("greet", 1, 1, 5))).resolves.toBe("kept")
        await expect(service.stepEnded(REF, ended("greet", 1, 1, 3))).resolves.toBe("written")
        const writes = store.writes
        await expect(service.stepEnded(REF, ended("greet", 1, 1, 9))).resolves.toBe("kept")
        await expect(service.stepStarted(REF, step("greet", 1, 1, 12))).resolves.toBe("kept")

        expect(store.writes).toBe(writes)
        expect(store.stepsOf("run-1")).toHaveLength(1)
        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({
            runId: "run-1",
            stepKey: "greet",
            ordinal: 1,
            status: "done",
            attempt: 1,
            startedAt: at(0).toISOString(),
            endedAt: at(3).toISOString(),
            durationMs: 3000,
            result: { output: { said: true }, effects: [] },
            errorCode: null,
            claimedUntil: null,
            notBefore: null,
            doorCalls: { calls: [{ tool: "nivo.tool.customer.message.send", ok: true, effectKey: "call:run-1:reply:abc" }] },
            input: { versionId: "v-1", nodeKey: "greet", trigger: { text: "hi" } },
        })
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "running", stepSeq: 1 })
    })

    it("writes a step whose start was lost whole from its end, at its place in the path", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await service.stepEnded(REF, ended("a", 1, 1, 2))
        await service.stepEnded(REF, ended("b", 2, 1, 4))

        expect(store.stepsOf("run-1").map((row) => [row.data.stepKey, row.data.ordinal, row.data.status])).toEqual([
            ["a", 1, "done"],
            ["b", 2, "done"],
        ])
        expect(store.stepsOf("run-1")[0]?.data.startedAt).toBe(at(2).toISOString())
        expect(store.get(RUN, "run-1")?.data.stepSeq).toBe(2)
    })
})

describe("ThreadProjectionService stops", () => {
    it("shows a stop on the step and the run, then the founder's retry as the next try of the same row", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await service.stepStarted(REF, step("match", 1, 1, 0))
        await expect(service.stepStopped(REF, stopped("match", 1, 1, 4))).resolves.toBe("written")
        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({
            status: "failed",
            errorCode: "ai_confused",
            error: { code: "ai_confused", reason: "two addresses" },
            endedAt: at(4).toISOString(),
            durationMs: 4000,
            waitItemId: null,
        })
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "waiting", error: { code: "ai_confused" } })
        await expect(service.stepStopped(REF, stopped("match", 1, 1, 30))).resolves.toBe("kept")
        await expect(service.takenOver(REF, "owner-1")).resolves.toBe("written")
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "waiting", error: { code: "taken_over", by: "owner-1" } })

        await expect(service.resumed(REF, { at: at(60) })).resolves.toBe("written")
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "running", error: null })
        await service.stepStarted(REF, step("match", 1, 2, 61))
        await expect(service.stepStopped(REF, stopped("match", 1, 1, 62))).resolves.toBe("kept")
        await service.stepEnded(REF, ended("match", 1, 2, 65))

        expect(store.stepsOf("run-1")).toHaveLength(1)
        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({
            status: "done",
            attempt: 2,
            maxAttempts: 2,
            errorCode: null,
            error: null,
            startedAt: at(61).toISOString(),
            durationMs: 4000,
        })
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "running", error: null })
    })

    it("shows a stop for an approval as a step that waits on its item, and its end on the same try", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await service.stepStarted(REF, step("order", 1, 1, 0))
        await service.stepStopped(REF, { ...stopped("order", 1, 1, 2), code: "approval", waitItemId: "item-1" })
        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({
            status: "running",
            waitItemId: "item-1",
            workItemId: "item-1",
            endedAt: null,
        })
        await expect(service.stepStarted(REF, step("order", 1, 1, 9))).resolves.toBe("kept")
        await service.stepEnded(REF, ended("order", 1, 1, 10))

        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({
            status: "done",
            waitItemId: null,
            workItemId: "item-1",
            durationMs: 10000,
        })
    })

    it("records a side step that failed and was passed over, and the run goes on", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)

        await service.stepEnded(REF, { ...ended("notify", 1, 1, 1), code: "tool_denied" })

        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({ status: "failed", errorCode: "tool_denied" })
        expect(store.get(RUN, "run-1")?.data.status).toBe("running")
    })
})

describe("ThreadProjectionService run ends and races", () => {
    it("ends the run once: done, skipped by a founder as cancelled by them, or failed and never told again", async () => {
        const cases = [
            [
                { outcome: "done", code: null, by: null },
                { status: "done", error: null },
            ],
            [
                { outcome: "skipped", code: null, by: "member-1" },
                {
                    status: "cancelled",
                    cancelledBy: "member-1",
                    cancelledAt: at(9).toISOString(),
                    error: { code: "skipped" },
                },
            ],
            [
                { outcome: "failed", code: "node_missing", by: null },
                { status: "failed", error: { code: "node_missing" }, deadLetteredAt: at(9).toISOString() },
            ],
        ] as const
        for (const [end, expected] of cases) {
            const store = new Store()
            openRun(store, { status: "waiting" })
            const service = await build(store)

            await expect(service.runEnded(REF, { ...end, at: at(9) })).resolves.toBe("written")
            await expect(service.runEnded(REF, { ...end, at: at(20) })).resolves.toBe("kept")
            await expect(service.resumed(REF, { at: at(21) })).resolves.toBe("kept")

            expect(store.get(RUN, "run-1")?.data).toMatchObject({ ...expected, endedAt: at(9).toISOString() })
        }
    })

    it("closes, with the run's end, the step rows it left open (a loop step and the wait inside it), with the run's terminal reason", async () => {
        const cases = [
            [{ outcome: "skipped", code: "skipped_by_founder", by: "member-1" }, "skipped_by_founder"],
            [{ outcome: "skipped", code: "route_held", by: null }, "route_held"],
            [{ outcome: "failed", code: "thread_redrive_exhausted", by: null }, "thread_redrive_exhausted"],
            [{ outcome: "done", code: null, by: null }, "run_ended"],
        ] as const
        for (const [end, code] of cases) {
            const store = new Store()
            openRun(store)
            const service = await build(store)
            await service.stepStarted(REF, step("talk", 1, 1, 0))
            await service.stepStarted(REF, step("talk[r1].consult", 2, 1, 1))
            await service.stepEnded(REF, ended("talk[r1].consult", 2, 1, 2))
            await service.stepStarted(REF, step("talk[r2].hear", 3, 1, 3))

            await expect(service.runEnded(REF, { ...end, at: at(9) })).resolves.toBe("written")

            expect(store.stepsOf("run-1").map((row) => [row.data.stepKey, row.data.status, row.data.errorCode])).toEqual([
                ["talk", "failed", code],
                ["talk[r1].consult", "done", null],
                ["talk[r2].hear", "failed", code],
            ])
            expect(store.stepsOf("run-1")[0]?.data).toMatchObject({ endedAt: at(9).toISOString(), durationMs: 9000, error: { code } })
            // A late start of a step of the closed run keeps the closed row (a lower rank of the same try).
            await expect(service.stepStarted(REF, step("talk[r2].hear", 3, 1, 10))).resolves.toBe("kept")
            expect(store.stepsOf("run-1")[2]?.data.status).toBe("failed")
        }
    })

    it("closes the open steps of a run that was already closed before this rule (a replay of its end catches it up)", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)
        await service.stepStarted(REF, step("talk", 1, 1, 0))
        const run = store.get(RUN, "run-1")
        store.put(RUN, "run-1", { ...run?.data, status: "cancelled", error: { code: "subject_erased" }, endedAt: at(5).toISOString() })

        await expect(service.runEnded(REF, { outcome: "done", code: null, by: null, at: at(9) })).resolves.toBe("written")
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "cancelled", error: { code: "subject_erased" } })
        expect(store.stepsOf("run-1")[0]?.data).toMatchObject({ status: "failed", errorCode: "subject_erased" })
        await expect(service.runEnded(REF, { outcome: "done", code: null, by: null, at: at(12) })).resolves.toBe("kept")
    })

    it("writes the step but leaves a run an owner cancelled as it is", async () => {
        const store = new Store()
        openRun(store, { status: "cancelled" })
        const service = await build(store)

        await service.stepStopped(REF, stopped("match", 3, 1, 1))

        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "cancelled", stepSeq: 3 })
        expect(store.stepsOf("run-1")[0]?.data.status).toBe("failed")
    })

    it("reads again and writes when another writer moved the run or the step first", async () => {
        const store = new Store()
        openRun(store)
        const service = await build(store)
        await service.stepStarted(REF, step("a", 1, 1, 0))

        store.raceOn = STEP
        await expect(service.stepEnded(REF, ended("a", 1, 1, 2))).resolves.toBe("written")
        store.raceOn = RUN
        await expect(service.stepStopped(REF, stopped("b", 2, 1, 3))).resolves.toBe("written")

        expect(store.stepsOf("run-1").map((row) => row.data.status)).toEqual(["done", "failed"])
        expect(store.get(RUN, "run-1")?.data).toMatchObject({ status: "waiting", stepSeq: 2 })
    })
})

describe("ThreadProjectionService repair", () => {
    const LIVE: ReadonlyArray<ThreadStepFactParams> = [
        { kind: "started", ...step("a", 1, 1, 0) },
        { kind: "ended", ...ended("a", 1, 1, 2) },
        { kind: "started", ...step("b", 2, 1, 3) },
        { kind: "stopped", ...stopped("b", 2, 1, 5) },
        { kind: "started", ...step("b", 2, 2, 40) },
        { kind: "ended", ...ended("b", 2, 2, 44) },
        { kind: "ended", ...ended("c", 3, 1, 47) },
    ]
    const END = { outcome: "done", code: null, by: null, at: at(48) } as const

    const live = async (): Promise<{ store: Store; service: ThreadProjectionService }> => {
        const store = new Store()
        openRun(store)
        const service = await build(store)
        await service.runStarted(REF)
        for (const fact of LIVE) {
            if (fact.kind === "started") await service.stepStarted(REF, fact)
            else if (fact.kind === "ended") await service.stepEnded(REF, fact)
            else await service.stepStopped(REF, fact)
            if (fact.kind === "stopped") await service.resumed(REF, { at: at(39) })
        }
        await service.runEnded(REF, END)
        return { store, service }
    }

    it("writes nothing over rows that already say what the thread says", async () => {
        const { store, service } = await live()
        const before = rowsOf(store)
        const writes = store.writes

        await expect(service.repair(REF, { steps: LIVE, end: END })).resolves.toBe("kept")

        expect(store.writes).toBe(writes)
        expect(rowsOf(store)).toEqual(before)
    })

    it("brings back a lost step row and a run left behind, equal to the rows the live thread wrote", async () => {
        const { store, service } = await live()
        const before = rowsOf(store)
        const lost = store.stepsOf("run-1").find((row) => row.data.stepKey === "b")
        store.rows.delete(lost?.id ?? "")
        const run = store.get(RUN, "run-1")
        store.put(RUN, "run-1", { ...run?.data, status: "waiting", error: { code: "ai_confused" }, endedAt: null })

        await expect(service.repair(REF, { steps: LIVE, end: END })).resolves.toBe("written")

        expect(rowsOf(store)).toEqual(before)
    })

    it("answers missing for a thread whose run row is gone", async () => {
        const service = await build(new Store())

        await expect(service.repair(REF, { steps: LIVE, end: null })).resolves.toBe("missing")
    })
})
