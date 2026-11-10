import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { StepSpec } from "@modules/domain/agent-runs"
import type { EngineResult, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation } from "@nivo-lite/agent-sdk/mutation"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { ThreadProjectionService } from "./thread-projection.service"
import type {
    ThreadRunRefParams,
    ThreadStepCallParams,
    ThreadStepEndParams,
    ThreadStepFactParams,
    ThreadStepParams,
    ThreadStepStopParams,
} from "./thread-projection.contracts"

const RUN = "agent.run"
const STEP = "agent.run-step"
const REF: ThreadRunRefParams = { workspaceId: "ws-1", runId: "run-1" }
const T0 = new Date("2026-11-10T10:00:00.000Z")
const at = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000)

/** A records table as the engine keeps it: rows by id, every row a copy, a version that moves on each write. */
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

const build = async (store: Store): Promise<ThreadProjectionService> => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    engine.get.mockImplementation((_tx, entity, id) => Promise.resolve(store.get(entity, id)))
    engine.list.mockImplementation((_tx, query: Query): Promise<ListPage> => {
        const where = query.where
        const runId = where !== undefined && where.op === "eq" ? where.value : null
        const rows = store.stepsOf(runId).map((row) => ({ row, joined: {}, position: [], included: {} }))
        return Promise.resolve({ rows, next: null })
    })
    const mutations = mock<EntityMutationService>()
    mutations.mutate.mockImplementation((_tx, mutation) => Promise.resolve(store.mutate(mutation)))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadProjectionService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return moduleRef.get(ThreadProjectionService)
}

const specOf = (key: string): StepSpec => ({
    stepKey: key,
    nodeKey: key,
    kind: "graph_node",
    effect: { kind: "pivot" },
    input: { versionId: "v-1", nodeKey: key, trigger: { text: "hi" }, skipped: undefined },
})

const step = (key: string, ordinal: number, attempt: number, seconds: number): ThreadStepParams => ({
    spec: specOf(key),
    ordinal,
    attempt,
    at: at(seconds),
})

const CALLS: ReadonlyArray<ThreadStepCallParams> = [
    { tool: "customer.message.send", ok: true, failure: null, effectKey: "call:run-1:reply:abc" },
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
            doorCalls: { calls: [{ tool: "customer.message.send", ok: true, effectKey: "call:run-1:reply:abc" }] },
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
