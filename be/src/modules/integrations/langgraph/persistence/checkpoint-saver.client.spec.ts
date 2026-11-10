import type { RunnableConfig } from "@langchain/core/runnables"
import {
    ERROR,
    emptyCheckpoint,
    uuid6,
    type Checkpoint,
    type CheckpointMetadata,
    type CheckpointTuple,
} from "@langchain/langgraph-checkpoint"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { memoryCheckpointStore } from "@tests/fixtures/builders/checkpoint-store.builder"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { LanggraphErrorCode } from "../errors/langgraph.error"
import { LanggraphClient } from "../langgraph.client"
import { GRAPH_CHECKPOINTS, LANGGRAPH_OPTIONS } from "../langgraph.decorators"
import type { LanggraphOptions } from "../langgraph.options"
import { THREAD_END, type ThreadGraph, type ThreadRef } from "../langgraph.port"
import { CHECKPOINT_LIMITS, CHECKPOINT_STORE } from "./checkpoint.decorators"
import { CheckpointLogEvent } from "./checkpoint.log-events"
import { CheckpointSaverClient } from "./checkpoint-saver.client"
import { DEFAULT_CHECKPOINT_LIMITS, type CheckpointLimits } from "./checkpoint-size.policy"
import type { CheckpointStore } from "./checkpoint-store.port"

const SHOP = "0b5d1c1e-6f0a-4c56-9d5e-0d3f4a1b2c01"
const OTHER_SHOP = "0b5d1c1e-6f0a-4c56-9d5e-0d3f4a1b2c02"
const THREAD = "5f0f7a0c-1111-4a6b-8c3d-2e4f6a8b0c01"
const LOOP: CheckpointMetadata = { source: "loop", step: 0, parents: {} }
const OPTIONS: LanggraphOptions = { compiledMax: 4, stepLimit: 50 }
const RUN: ThreadRef = { workspaceId: SHOP, runId: THREAD }
const OTHER_RUN: ThreadRef = { workspaceId: OTHER_SHOP, runId: "5f0f7a0c-1111-4a6b-8c3d-2e4f6a8b0c02" }
const GATE = "__freeze"

/** What the founder decides at the gate. */
interface Decision {
    readonly kind: string
    readonly text?: string
}

const build = async (given: Partial<CheckpointLimits> = {}) => {
    const memory = memoryCheckpointStore()
    const store = mock<CheckpointStore>(memory.port)
    const limits = mock<CheckpointLimits>({ ...DEFAULT_CHECKPOINT_LIMITS, ...given })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CheckpointSaverClient,
            { provide: GRAPH_CHECKPOINTS, useExisting: CheckpointSaverClient },
            LanggraphClient,
            { provide: LANGGRAPH_OPTIONS, useValue: OPTIONS },
            { provide: CHECKPOINT_STORE, useValue: store },
            { provide: CHECKPOINT_LIMITS, useValue: limits },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        saver: moduleRef.get(CheckpointSaverClient),
        threads: moduleRef.get(LanggraphClient),
        store,
        memory,
        logger,
    }
}

/** The config of a call on the thread: its workspace and, for a driver, its fence; `checkpointId` names a stored checkpoint. */
const at = (workspaceId: string, fence?: number, checkpointId?: string): RunnableConfig => ({
    configurable: {
        thread_id: THREAD,
        checkpoint_ns: "",
        workspace_id: workspaceId,
        fence,
        checkpoint_id: checkpointId,
    },
})

/** A checkpoint with one value on each named channel, all at version 1. */
const checkpointWith = (values: Record<string, unknown>, clock = 1): Checkpoint => ({
    ...emptyCheckpoint(),
    id: uuid6(clock),
    channel_values: values,
    channel_versions: Object.fromEntries(Object.keys(values).map((channel) => [channel, 1])),
})

const listed = async (saver: CheckpointSaverClient, config: RunnableConfig): Promise<Array<CheckpointTuple>> => {
    const tuples: Array<CheckpointTuple> = []
    for await (const tuple of saver.list(config)) tuples.push(tuple)
    return tuples
}

describe("CheckpointSaverClient: every row belongs to one workspace", () => {
    it("stores the workspace of the call on the checkpoint, its values and its writes", async () => {
        const { saver, memory } = await build()
        const checkpoint = checkpointWith({ trigger: "order" })

        const stored = await saver.put(at(SHOP), checkpoint, LOOP, { trigger: 1 })
        await saver.putWrites(at(SHOP, undefined, checkpoint.id), [["steps", { ask: "done" }]], "task-1")

        expect(stored).toEqual({ configurable: { thread_id: THREAD, checkpoint_ns: "", checkpoint_id: checkpoint.id } })
        expect(memory.rowsOf(THREAD).map((row) => row.row.workspaceId)).toEqual([SHOP, SHOP, SHOP])
    })

    it("answers nothing of a thread to another workspace", async () => {
        const { saver } = await build()
        const checkpoint = checkpointWith({ trigger: "order" })
        await saver.put(at(SHOP), checkpoint, LOOP, { trigger: 1 })

        expect(await saver.getTuple(at(OTHER_SHOP))).toBeUndefined()
        expect(await saver.getTuple(at(OTHER_SHOP, undefined, checkpoint.id))).toBeUndefined()
        expect(await listed(saver, at(OTHER_SHOP))).toEqual([])
        expect((await saver.getTuple(at(SHOP)))?.checkpoint.channel_values).toEqual({ trigger: "order" })
    })

    it("refuses a write to a thread another workspace already holds, and leaves that workspace's rows as they were", async () => {
        const { saver, store } = await build()
        const checkpoint = checkpointWith({ trigger: "ours" })
        await saver.put(at(SHOP, 5), checkpoint, LOOP, { trigger: 1 })
        const before = await store.usage(SHOP, THREAD)
        const refusal = { code: LanggraphErrorCode.CheckpointScopeMissing, params: { key: "workspace_id" } }

        await expect(
            saver.put(at(OTHER_SHOP, 9), { ...checkpoint, channel_values: { trigger: "theirs" } }, LOOP, {
                trigger: 1,
            }),
        ).rejects.toMatchObject(refusal)
        await expect(saver.putWrites(at(OTHER_SHOP, 9, checkpoint.id), [["steps", 1]], "task-1")).rejects.toMatchObject(
            refusal,
        )

        expect(await store.usage(SHOP, THREAD)).toEqual(before)
        expect((await saver.getTuple(at(SHOP)))?.checkpoint.channel_values).toEqual({ trigger: "ours" })
        expect(await saver.getTuple(at(OTHER_SHOP))).toBeUndefined()
    })

    it("refuses a read or a write that names no workspace", async () => {
        const { saver, memory } = await build()
        const bare: RunnableConfig = { configurable: { thread_id: THREAD, checkpoint_ns: "", checkpoint_id: uuid6(1) } }
        const refusal = { code: LanggraphErrorCode.CheckpointScopeMissing, params: { key: "workspace_id" } }

        await expect(saver.getTuple(bare)).rejects.toMatchObject(refusal)
        await expect(listed(saver, bare)).rejects.toMatchObject(refusal)
        await expect(saver.put(bare, checkpointWith({}), LOOP, {})).rejects.toMatchObject(refusal)
        await expect(saver.putWrites(bare, [["steps", 1]], "task-1")).rejects.toMatchObject(refusal)
        expect(memory.rowsOf(THREAD)).toEqual([])
    })

    it("deletes a thread and leaves the other threads, by the library's call and by the retention call", async () => {
        const { saver, store } = await build()
        const kept: RunnableConfig = { configurable: { thread_id: "kept", workspace_id: SHOP } }
        const ended: RunnableConfig = { configurable: { thread_id: "ended", workspace_id: SHOP } }
        for (const config of [at(SHOP), kept, ended])
            await saver.put(config, checkpointWith({ trigger: "order" }), LOOP, { trigger: 1 })

        await saver.deleteThread(THREAD)
        await store.deleteWorkspaceThread(OTHER_SHOP, "kept")
        await store.deleteWorkspaceThread(SHOP, "ended")

        expect(await saver.getTuple(at(SHOP))).toBeUndefined()
        expect(await saver.getTuple(ended)).toBeUndefined()
        expect(await store.usage(SHOP, "ended")).toEqual({ checkpoints: 0, blobs: 0, writes: 0, bytes: 0 })
        expect(await saver.getTuple(kept)).toBeDefined()
    })
})

describe("CheckpointSaverClient: the fence", () => {
    it("stamps each row with the fence of the driver that wrote it", async () => {
        const { saver, memory } = await build()
        const checkpoint = checkpointWith({ trigger: "order" })

        await saver.put(at(SHOP, 3), checkpoint, LOOP, { trigger: 1 })
        await saver.putWrites(at(SHOP, 3, checkpoint.id), [["steps", 1]], "task-1")

        expect(memory.rowsOf(THREAD).map((row) => row.fence)).toEqual([3, 3, 3])
    })

    it("refuses the checkpoint and the writes of a driver once a newer one wrote, and stores nothing of them", async () => {
        const { saver, store, logger } = await build()
        const first = checkpointWith({ trigger: "order" })
        await saver.put(at(SHOP, 1), first, LOOP, { trigger: 1 })
        await saver.put(at(SHOP, 2, first.id), checkpointWith({ trigger: "order" }, 2), LOOP, {})
        const before = await store.usage(SHOP, THREAD)
        const refusal = { code: LanggraphErrorCode.CheckpointFenced, params: { thread: THREAD, fence: "1" } }

        await expect(
            saver.put(at(SHOP, 1), checkpointWith({ trigger: "late" }, 3), LOOP, { trigger: 1 }),
        ).rejects.toMatchObject(refusal)
        await expect(saver.putWrites(at(SHOP, 1, first.id), [["steps", 1]], "task-1")).rejects.toMatchObject(refusal)

        expect(await store.usage(SHOP, THREAD)).toEqual(before)
        expect(logger.warn).toHaveBeenCalledWith(CheckpointLogEvent.WriteFenced, { thread: THREAD, fence: 1 })
    })

    it("refuses a superseded driver as soon as the lease is taken, before the new driver wrote anything", async () => {
        const { saver, memory } = await build()
        await saver.put(at(SHOP, 1), checkpointWith({ trigger: "order" }), LOOP, { trigger: 1 })

        memory.takeOver(THREAD, 2)

        await expect(saver.put(at(SHOP, 1), checkpointWith({ trigger: "late" }, 2), LOOP, {})).rejects.toMatchObject({
            code: LanggraphErrorCode.CheckpointFenced,
        })
        await expect(saver.put(at(SHOP, 2), checkpointWith({ trigger: "order" }, 3), LOOP, {})).resolves.toBeDefined()
    })

    it("refuses a writer with no fence on a thread a driver wrote, and lets the same driver write again", async () => {
        const { saver } = await build()
        await saver.put(at(SHOP, 4), checkpointWith({ trigger: "order" }), LOOP, { trigger: 1 })

        await expect(saver.put(at(SHOP), checkpointWith({}, 2), LOOP, {})).rejects.toMatchObject({
            code: LanggraphErrorCode.CheckpointFenced,
            params: { fence: "null" },
        })
        await expect(saver.put(at(SHOP, 4), checkpointWith({}, 3), LOOP, {})).resolves.toBeDefined()
    })
})

describe("CheckpointSaverClient: each channel value is stored once per version", () => {
    it("stores the value of a channel once, however many checkpoints carry it", async () => {
        const { saver, store, memory } = await build()
        const trigger = { order: "o-1", lines: ["a", "b"] }
        const first = checkpointWith({ trigger, steps: {} })
        const second: Checkpoint = {
            ...first,
            id: uuid6(2),
            channel_values: { trigger, steps: { ask: "done" } },
            channel_versions: { trigger: 1, steps: 2 },
        }
        const third: Checkpoint = {
            ...first,
            id: uuid6(3),
            channel_values: { trigger, steps: { ask: "done", pay: "done" } },
            channel_versions: { trigger: 1, steps: 3 },
        }

        await saver.put(at(SHOP, 1), first, LOOP, { trigger: 1, steps: 1 })
        await saver.put(at(SHOP, 1, first.id), second, LOOP, { steps: 2 })
        await saver.put(at(SHOP, 1, second.id), third, LOOP, { steps: 3 })

        expect(memory.valuesOf(THREAD, "trigger")).toHaveLength(1)
        expect(memory.valuesOf(THREAD, "steps")).toHaveLength(3)
        expect(await store.usage(SHOP, THREAD)).toMatchObject({ checkpoints: 3, blobs: 4, writes: 0 })
        expect((await saver.getTuple(at(SHOP)))?.checkpoint.channel_values).toEqual({
            trigger,
            steps: { ask: "done", pay: "done" },
        })
        expect((await saver.getTuple(at(SHOP, undefined, second.id)))?.checkpoint.channel_values).toEqual({
            trigger,
            steps: { ask: "done" },
        })
        expect((await saver.getTuple(at(SHOP, undefined, second.id)))?.parentConfig).toEqual({
            configurable: { thread_id: THREAD, checkpoint_ns: "", checkpoint_id: first.id },
        })
    })

    it("mints channel versions that rise by one and differ between two drivers", async () => {
        const { saver } = await build()

        const [first, second] = [saver.getNextVersion(undefined), saver.getNextVersion(undefined)]

        expect(Math.floor(first)).toBe(1)
        expect(Math.floor(saver.getNextVersion(first))).toBe(2)
        expect(first).not.toBe(second)
    })

    it("keeps a task's ordinary write as first stored and replaces the library's special writes", async () => {
        const { saver } = await build()
        const checkpoint = checkpointWith({})
        await saver.put(at(SHOP), checkpoint, LOOP, {})
        const pending = at(SHOP, undefined, checkpoint.id)

        await saver.putWrites(pending, [["steps", "first"]], "task-1")
        await saver.putWrites(pending, [["steps", "again"]], "task-1")
        await saver.putWrites(pending, [[ERROR, "timeout"]], "task-2")
        await saver.putWrites(pending, [[ERROR, "refused"]], "task-2")

        expect((await saver.getTuple(at(SHOP)))?.pendingWrites).toEqual([
            ["task-1", "steps", "first"],
            ["task-2", ERROR, "refused"],
        ])
    })
})

describe("CheckpointSaverClient: the size of what is stored", () => {
    it("logs a value that reached the warning size and still stores it", async () => {
        const { saver, memory, logger } = await build({ warnBytes: 100, maxBytes: 10_000 })

        await saver.put(at(SHOP), checkpointWith({ steps: "x".repeat(200) }), LOOP, { steps: 1 })

        expect(logger.warn).toHaveBeenCalledWith(CheckpointLogEvent.ValueLarge, {
            thread: THREAD,
            what: "value",
            name: "steps",
            bytes: 202,
        })
        expect(memory.valuesOf(THREAD, "steps")).toHaveLength(1)
    })

    it("refuses a value over the maximum and stores nothing of the checkpoint or the write", async () => {
        const { saver, store } = await build({ warnBytes: 100, maxBytes: 1000 })
        const checkpoint = checkpointWith({ steps: "ok" })
        await saver.put(at(SHOP), checkpoint, LOOP, { steps: 1 })
        const before = await store.usage(SHOP, THREAD)
        const refusal = {
            code: LanggraphErrorCode.CheckpointTooLarge,
            params: { thread: THREAD, bytes: "2002", limit: "1000" },
        }

        await expect(
            saver.put(at(SHOP), checkpointWith({ steps: "x".repeat(2000) }, 2), LOOP, { steps: 1 }),
        ).rejects.toMatchObject(refusal)
        await expect(
            saver.putWrites(at(SHOP, undefined, checkpoint.id), [["steps", "x".repeat(2000)]], "task-1"),
        ).rejects.toMatchObject(refusal)

        expect(await store.usage(SHOP, THREAD)).toEqual(before)
    })

    it("holds the default limits when the app provides none", async () => {
        const logger = mock<Logger>()
        const store = mock<CheckpointStore>(memoryCheckpointStore().port)
        const moduleRef = await Test.createTestingModule({
            providers: [
                CheckpointSaverClient,
                { provide: CHECKPOINT_STORE, useValue: store },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()

        await moduleRef
            .get(CheckpointSaverClient)
            .put(at(SHOP), checkpointWith({ steps: "x".repeat(DEFAULT_CHECKPOINT_LIMITS.warnBytes) }), LOOP, {
                steps: 1,
            })

        expect(logger.warn).toHaveBeenCalledWith(CheckpointLogEvent.ValueLarge, {
            thread: THREAD,
            what: "value",
            name: "steps",
            bytes: DEFAULT_CHECKPOINT_LIMITS.warnBytes + 2,
        })
    })

    it("answers at most the list limit", async () => {
        const { saver } = await build({ listMax: 2 })
        for (const clock of [1, 2, 3]) await saver.put(at(SHOP), checkpointWith({}, clock), LOOP, {})

        expect(await listed(saver, at(SHOP))).toHaveLength(2)
    })
})

/** The shape of a NIVO workflow: a step that completes, a step that asks the founder once, the gate, a last step. */
const workflow = (ran: Array<string>): ThreadGraph => ({
    version: "version-1",
    entry: "greet",
    nodes: [
        {
            key: "greet",
            next: "consult",
            run: () => {
                ran.push("greet")
                return Promise.resolve({ update: { steps: { greet: { said: "hello" } } } })
            },
        },
        {
            key: "consult",
            next: "close",
            ends: [GATE],
            run: (state) => {
                ran.push("consult")
                const answers = state.founderAnswers.length
                return Promise.resolve(
                    answers === 0
                        ? { update: { trouble: { reason: "unclear" } }, goto: GATE }
                        : { update: { steps: { consult: { answers } } } },
                )
            },
        },
        {
            key: GATE,
            ends: ["consult"],
            run: (state, scope) => {
                const decision = scope.stop<Decision>({ about: state.trouble })
                const answered = {
                    update: { trouble: null, founderAnswers: [...state.founderAnswers, decision] },
                    goto: "consult",
                }
                return Promise.resolve(
                    decision.kind === "skip" ? { update: { trouble: null }, goto: THREAD_END } : answered,
                )
            },
        },
        {
            key: "close",
            run: () => {
                ran.push("close")
                return Promise.resolve({ update: { steps: { close: { done: true } } } })
            },
        },
    ],
})

const ANSWER: Decision = { kind: "answer", text: "ship it" }
const ENDED_STEPS = { greet: { said: "hello" }, consult: { answers: 1 }, close: { done: true } }

describe("LanggraphClient over CheckpointSaverClient", () => {
    it("starts a thread, stops it at the gate, and a resume ends it without running a finished step again", async () => {
        const { threads, memory } = await build()
        const ran: Array<string> = []
        const graph = workflow(ran)

        const stopped = await threads.start(RUN, graph, { trigger: { order: "o-1" } }, { fence: 1 })
        const view = await threads.stateOf(RUN)
        const ended = await threads.resume(RUN, graph, ANSWER, { fence: 1 })

        expect(stopped).toMatchObject({
            status: "stopped",
            stop: { node: GATE, question: { about: { reason: "unclear" } } },
        })
        expect(view).toMatchObject({ version: "version-1", status: "stopped", next: [GATE] })
        expect(ended).toMatchObject({
            status: "ended",
            state: { trigger: { order: "o-1" }, steps: ENDED_STEPS, founderAnswers: [ANSWER] },
        })
        expect(ran).toEqual(["greet", "consult", "consult", "close"])
        expect(new Set(memory.rowsOf(RUN.runId).map((stored) => `${stored.row.workspaceId}:${stored.fence}`))).toEqual(
            new Set([`${SHOP}:1`]),
        )
        expect(memory.valuesOf(RUN.runId, "trigger")).toHaveLength(1)
    })

    it("keeps two workspaces apart: each sees its own thread and nothing of the other's", async () => {
        const { threads, store } = await build()
        const graph = workflow([])

        await threads.start(RUN, graph, { trigger: { order: "ours" } }, { fence: 1 })
        await threads.start(OTHER_RUN, graph, { trigger: { order: "theirs" } }, { fence: 1 })
        await threads.resume(OTHER_RUN, graph, { kind: "skip" }, { fence: 1 })

        expect(await threads.stateOf(RUN)).toMatchObject({ status: "stopped", state: { trigger: { order: "ours" } } })
        expect(await threads.stateOf(OTHER_RUN)).toMatchObject({
            status: "ended",
            state: { trigger: { order: "theirs" } },
        })
        expect(await threads.stateOf({ workspaceId: OTHER_SHOP, runId: RUN.runId })).toBeNull()
        expect(await threads.stateOf({ workspaceId: SHOP, runId: OTHER_RUN.runId })).toBeNull()
        expect((await store.usage(OTHER_SHOP, RUN.runId)).checkpoints).toBe(0)
    })
})

describe("LanggraphClient over CheckpointSaverClient: refusals", () => {
    it("refuses another workspace that names a run it does not own, and leaves the run as it was", async () => {
        const { threads, store } = await build()
        const graph = workflow([])
        await threads.start(RUN, graph, { trigger: { order: "ours" } }, { fence: 1 })
        const before = await store.usage(SHOP, RUN.runId)

        const forged = threads.start(
            { workspaceId: OTHER_SHOP, runId: RUN.runId },
            graph,
            { trigger: { order: "theirs" } },
            { fence: 9 },
        )

        await expect(forged).rejects.toMatchObject({ code: LanggraphErrorCode.CheckpointScopeMissing })
        expect(await store.usage(SHOP, RUN.runId)).toEqual(before)
        expect(await threads.stateOf(RUN)).toMatchObject({ status: "stopped", state: { trigger: { order: "ours" } } })
    })

    it("refuses the resume of a driver whose lease was taken over, and the new driver ends the thread once", async () => {
        const { threads, store, memory } = await build()
        const ran: Array<string> = []
        const graph = workflow(ran)
        await threads.start(RUN, graph, { trigger: { order: "o-1" } }, { fence: 1 })
        const before = await store.usage(SHOP, RUN.runId)

        memory.takeOver(RUN.runId, 2)
        const stale = threads.resume(RUN, graph, { kind: "answer", text: "late" }, { fence: 1 })

        await expect(stale).rejects.toMatchObject({ code: LanggraphErrorCode.CheckpointFenced })
        expect(await store.usage(SHOP, RUN.runId)).toEqual(before)
        expect(await threads.stateOf(RUN)).toMatchObject({ status: "stopped", next: [GATE] })
        expect(await threads.resume(RUN, graph, ANSWER, { fence: 2 })).toMatchObject({
            status: "ended",
            state: { steps: ENDED_STEPS, founderAnswers: [ANSWER] },
        })
        expect(ran.filter((key) => key === "close")).toEqual(["close"])
    })

    it("lets a stale driver read an ended thread: driving it writes nothing and answers ended", async () => {
        const { threads } = await build()
        const graph = workflow([])
        await threads.start(RUN, graph, { trigger: { order: "o-1" } }, { fence: 1 })
        await threads.resume(RUN, graph, ANSWER, { fence: 2 })

        expect(await threads.drive(RUN, graph, { fence: 1 })).toMatchObject({ status: "ended" })
        expect(await threads.stateOf(RUN)).toMatchObject({ status: "ended", state: { steps: ENDED_STEPS } })
    })
})
