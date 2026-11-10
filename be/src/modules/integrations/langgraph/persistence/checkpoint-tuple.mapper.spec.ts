import type { RunnableConfig } from "@langchain/core/runnables"
import {
    TASKS,
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
import { CHECKPOINT_STORE } from "./checkpoint.decorators"
import { CheckpointSaverClient } from "./checkpoint-saver.client"
import type { CheckpointStore } from "./checkpoint-store.port"
import { orderedWrites, tupleConfigOf } from "./checkpoint-tuple.mapper"

/**
 * The conformance cases of the library's own saver validation kit (`@langchain/langgraph-checkpoint-validation` 1.2.0, suites put,
 * putWrites, getTuple, list, deleteThread), ported to jest: the kit is not installed in this repository. Each case keeps the kit's
 * inputs and expectations; the only addition is the workspace every call names, which the kit does not know.
 */

const SHOP = "0b5d1c1e-6f0a-4c56-9d5e-0d3f4a1b2c01"
const NAMESPACES = ["", "child"]
const INPUT: CheckpointMetadata = { source: "input", step: -1, parents: {} }

const build = async () => {
    const store = mock<CheckpointStore>(memoryCheckpointStore().port)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CheckpointSaverClient,
            { provide: CHECKPOINT_STORE, useValue: store },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return moduleRef.get(CheckpointSaverClient)
}

/** The config of a call: the kit's keys plus the workspace. An undefined key is one the caller did not name. */
const at = (threadId?: string, namespace?: string, checkpointId?: string): RunnableConfig => ({
    configurable: { workspace_id: SHOP, thread_id: threadId, checkpoint_ns: namespace, checkpoint_id: checkpointId },
})

/** The config a stored tuple carries: the three library keys and nothing else. */
const named = (threadId: string, namespace: string, checkpointId: string): RunnableConfig => ({
    configurable: { thread_id: threadId, checkpoint_ns: namespace, checkpoint_id: checkpointId },
})

/** The kit's first checkpoint of a thread: every channel at version 1. */
const initial = (checkpointId: string, values: Record<string, unknown> = {}): Checkpoint => ({
    v: 4,
    ts: "2026-11-10T00:00:00.000Z",
    id: checkpointId,
    channel_values: values,
    channel_versions: Object.fromEntries(Object.keys(values).map((channel) => [channel, 1])),
    versions_seen: { "": { someChannel: 1 } },
})

const listed = async (
    saver: CheckpointSaverClient,
    config: RunnableConfig,
    options?: Parameters<CheckpointSaverClient["list"]>[1],
) => {
    const tuples: Array<CheckpointTuple> = []
    for await (const tuple of saver.list(config, options)) tuples.push(tuple)
    return tuples
}

/** What the kit seeds per thread and namespace: a parent with a pending send and a child that one task wrote. */
const seeded = async (
    saver: CheckpointSaverClient,
    threadId: string,
    namespace: string,
): Promise<Array<CheckpointTuple>> => {
    const [parentId, childId] = [uuid6(3), uuid6(3)]
    const parent = initial(parentId, { animals: ["dog"] })
    const child: Checkpoint = {
        ...parent,
        id: childId,
        channel_values: { animals: ["fish", "dog"] },
        channel_versions: { animals: 2 },
    }
    await saver.put(at(threadId, namespace), parent, INPUT, { animals: 1 })
    await saver.putWrites(at(threadId, namespace, parentId), [[TASKS, ["add_fish"]]], "pending_sends_task")
    await saver.put(
        at(threadId, namespace, parentId),
        child,
        { source: "loop", step: 0, parents: { [namespace]: parentId } },
        { animals: 2 },
    )
    await saver.putWrites(at(threadId, namespace, childId), [["animals", ["fish", "dog"]]], "add_fish")
    const tuples = [
        await saver.getTuple(at(threadId, namespace, parentId)),
        await saver.getTuple(at(threadId, namespace, childId)),
    ]
    return tuples.filter((tuple) => tuple !== undefined)
}

/** The kit's writes of five tasks whose order by (task path, task id, index) differs from the order they were stored in. */
const putOutOfOrder = async (saver: CheckpointSaverClient, config: RunnableConfig): Promise<void> => {
    const eleven = Array.from({ length: 11 }, (_, index): [string, string] => ["ch", `a${index}`])
    await saver.putWrites(config, eleven, "ffffffff-ffff-ffff-ffff-ffffffffffff", "~pull, 02")
    await saver.putWrites(config, [["ch", "input"]], "88888888-8888-8888-8888-888888888888")
    await saver.putWrites(config, [["ch", "b"]], "00000000-0000-0000-0000-000000000000", "~pull, 01")
    await saver.putWrites(
        config,
        [["ch", "bmp"]],
        "99999999-9999-9999-9999-999999999999",
        `~pull, ${String.fromCodePoint(0xffff)}`,
    )
    await saver.putWrites(
        config,
        [["ch", "astral"]],
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        `~pull, ${String.fromCodePoint(0x10000)}`,
    )
}
const IN_ORDER = ["input", "b", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "bmp", "astral"]

/** The kit's two checkpoints in the format before pending sends moved into the checkpoint; the second continues the first. */
const putOldFormat = async (saver: CheckpointSaverClient, threadId: string): Promise<RunnableConfig> => {
    const old = { v: 1, channel_values: {}, channel_versions: {}, versions_seen: {} }
    const first: Checkpoint = { ...old, id: uuid6(0), ts: "2024-04-19T17:19:07.952Z" }
    await saver.put(at(threadId, ""), first, { source: "loop", parents: {}, step: 0 }, {})
    await saver.putWrites(
        at(threadId, "", first.id),
        [
            [TASKS, "send-1"],
            [TASKS, "send-2"],
        ],
        "task-1",
    )
    await saver.putWrites(at(threadId, "", first.id), [[TASKS, "send-3"]], "task-2")
    const second: Checkpoint = { ...old, id: uuid6(1), ts: "2024-04-20T17:19:07.952Z" }
    await saver.put(at(threadId, "", first.id), second, { source: "loop", parents: {}, step: 1 }, {})
    return at(threadId, "", first.id)
}

describe.each(NAMESPACES)("conformance: put, namespace '%s'", (namespace) => {
    it("returns a config with only thread_id, checkpoint_ns and checkpoint_id, and the tuple reads back without alteration", async () => {
        const saver = await build()
        const checkpoint = initial(uuid6(3))
        expect(await saver.get(at("thread", namespace, checkpoint.id))).toBeUndefined()

        const returned = await saver.put(at("thread", namespace), checkpoint, INPUT, {})
        const tuple = await saver.getTuple(at("thread", namespace, checkpoint.id))

        expect(returned).toEqual(named("thread", namespace, checkpoint.id))
        expect(tuple?.checkpoint).toEqual(checkpoint)
        expect(tuple?.metadata).toEqual(INPUT)
    })

    it("fails when config.configurable or the thread_id is missing", async () => {
        const saver = await build()

        await expect(saver.put({}, initial(uuid6(3)), INPUT, {})).rejects.toThrow()
        await expect(saver.put(at(undefined, namespace), initial(uuid6(3)), INPUT, {})).rejects.toThrow()
    })

    it("stores the writes of a task on the checkpoint", async () => {
        const saver = await build()
        const checkpoint = initial(uuid6(3))
        const returned = await saver.put(at("thread", namespace), checkpoint, INPUT, {})

        await saver.putWrites(at("thread", namespace, checkpoint.id), [["animals", "dog"]], "pet_task")
        const tuple = await saver.getTuple(at("thread", namespace, checkpoint.id))

        expect(tuple?.checkpoint).toEqual(checkpoint)
        expect(tuple?.metadata).toEqual(INPUT)
        expect(tuple?.config).toEqual(returned)
        expect(tuple?.pendingWrites).toEqual([["pet_task", "animals", "dog"]])
    })

    it("fails to store writes when the thread_id or the checkpoint_id is missing", async () => {
        const saver = await build()

        await expect(
            saver.putWrites(at(undefined, namespace, uuid6(3)), [["animals", "dog"]], "pet_task"),
        ).rejects.toThrow()
        await expect(saver.putWrites(at("thread", namespace), [["animals", "dog"]], "pet_task")).rejects.toThrow()
    })
})

describe("conformance: put, across namespaces", () => {
    it("defaults to the empty namespace when the config names none", async () => {
        const saver = await build()

        const returned = await saver.put(at("thread"), initial(uuid6(3)), INPUT, {})

        expect(returned.configurable?.checkpoint_ns).toBe("")
    })

    it("stores only the channel values that changed, as newVersions names them", async () => {
        const saver = await build()
        const read: Array<unknown> = []

        for (const newVersions of [{}, { foo: 1 }, { foo: 1, baz: 1 }]) {
            const checkpoint = initial(uuid6(3), { foo: "bar", baz: "qux" })
            await saver.put(at("thread", ""), checkpoint, INPUT, newVersions)
            read.push((await saver.getTuple(at("thread", "", checkpoint.id)))?.checkpoint.channel_values)
        }

        expect(read).toEqual([{}, { foo: "bar" }, { foo: "bar", baz: "qux" }])
    })
})

describe.each(NAMESPACES)("conformance: getTuple, namespace '%s'", (namespace) => {
    it("returns the first checkpoint by id: checkpoint, metadata, config, no parent, its writes", async () => {
        const saver = await build()
        const [parent] = await seeded(saver, "thread", namespace)
        const parentId = parent?.checkpoint.id ?? ""

        expect(parent?.checkpoint).toEqual(initial(parentId, { animals: ["dog"] }))
        expect(parent?.metadata).toEqual(INPUT)
        expect(parent?.config).toEqual(named("thread", namespace, parentId))
        expect(parent?.parentConfig).toBeUndefined()
        expect(parent?.pendingWrites).toEqual([["pending_sends_task", TASKS, ["add_fish"]]])
    })

    it("returns a later checkpoint by id with its parent, and the latest one when no id is given", async () => {
        const saver = await build()
        const [parent, child] = await seeded(saver, "thread", namespace)
        const [parentId, childId] = [parent?.checkpoint.id ?? "", child?.checkpoint.id ?? ""]

        const latest = await saver.getTuple(at("thread", namespace))

        expect(child?.checkpoint.channel_values).toEqual({ animals: ["fish", "dog"] })
        expect(child?.metadata).toEqual({ source: "loop", step: 0, parents: { [namespace]: parentId } })
        expect(child?.config).toEqual(named("thread", namespace, childId))
        expect(child?.parentConfig).toEqual(named("thread", namespace, parentId))
        expect(child?.pendingWrites).toEqual([["add_fish", "animals", ["fish", "dog"]]])
        expect(latest).toEqual(child)
    })

    it("returns undefined for an id that is not stored and for a config with no thread_id", async () => {
        const saver = await build()
        await seeded(saver, "thread", namespace)

        expect(await saver.getTuple(at("thread", namespace, uuid6(3)))).toBeUndefined()
        expect(await saver.getTuple(at(undefined, namespace))).toBeUndefined()
    })

    it("reconstructs a channel an ancestor wrote and the latest checkpoint did not", async () => {
        const saver = await build()
        const parent: Checkpoint = { ...initial(uuid6(3), { messages: ["hi"], stepCount: 1 }) }
        const child: Checkpoint = {
            ...parent,
            id: uuid6(3),
            channel_values: { messages: ["hi"], stepCount: 3 },
            channel_versions: { messages: 1, stepCount: 2 },
        }
        await saver.put(
            at("thread", namespace),
            parent,
            { source: "loop", step: 0, parents: {} },
            { messages: 1, stepCount: 1 },
        )
        await saver.put(
            at("thread", namespace, parent.id),
            child,
            { source: "loop", step: 1, parents: {} },
            { stepCount: 2 },
        )

        const [byId, latest] = [
            await saver.getTuple(at("thread", namespace, child.id)),
            await saver.getTuple(at("thread", namespace)),
        ]

        expect(byId?.checkpoint.channel_values).toEqual({ messages: ["hi"], stepCount: 3 })
        expect(latest?.checkpoint.channel_values).toEqual({ messages: ["hi"], stepCount: 3 })
    })
})

describe("checkpoint-tuple.mapper", () => {
    it("names a stored checkpoint by the three library keys only", () => {
        expect(tupleConfigOf({ threadId: "thread", namespace: "child", checkpointId: "c-1" })).toEqual(
            named("thread", "child", "c-1"),
        )
    })

    it("orders writes by task path, then task id, then index, a write with no path first", () => {
        const write = (taskPath: string, taskId: string, idx: number) => ({
            workspaceId: SHOP,
            threadId: "thread",
            namespace: "",
            checkpointId: "c-1",
            taskId,
            idx,
            channel: "ch",
            type: "json",
            payload: new Uint8Array(),
            taskPath,
        })
        const rows = [
            write("~pull, 02", "b", 1),
            write("~pull, 02", "b", 0),
            write("~pull, 01", "z", 0),
            write("", "m", 0),
            write("~pull, 02", "a", 5),
        ]

        expect(orderedWrites(rows).map((row) => [row.taskPath, row.taskId, row.idx])).toEqual([
            ["", "m", 0],
            ["~pull, 01", "z", 0],
            ["~pull, 02", "a", 5],
            ["~pull, 02", "b", 0],
            ["~pull, 02", "b", 1],
        ])
    })
})

describe("conformance: pending writes and pending sends", () => {
    it("returns pending writes in writesSortKey order from getTuple and from list", async () => {
        const saver = await build()
        const checkpoint: Checkpoint = { ...emptyCheckpoint(), id: uuid6(3) }
        await saver.put(at("thread", ""), checkpoint, { source: "loop", step: 0, parents: {} }, {})

        await putOutOfOrder(saver, at("thread", "", checkpoint.id))
        const [got, [fromList]] = [
            await saver.getTuple(at("thread", "", checkpoint.id)),
            await listed(saver, at("thread", "")),
        ]

        expect(got?.pendingWrites?.map((write) => write[2])).toEqual(IN_ORDER)
        expect(fromList?.pendingWrites?.map((write) => write[2])).toEqual(IN_ORDER)
    })

    it("migrates the pending sends of the parent into an old-format checkpoint, in getTuple and in list", async () => {
        const saver = await build()
        const firstConfig = await putOldFormat(saver, "thread-1")

        const [first, latest, tuples] = [
            await saver.getTuple(firstConfig),
            await saver.getTuple(at("thread-1", "")),
            await listed(saver, at("thread-1")),
        ]

        expect(first?.checkpoint.channel_values).toEqual({})
        expect(first?.checkpoint.channel_versions).toEqual({})
        expect(latest?.checkpoint.channel_values).toEqual({ [TASKS]: ["send-1", "send-2", "send-3"] })
        expect(latest?.checkpoint.channel_versions[TASKS]).toBeDefined()
        expect(tuples).toHaveLength(2)
        expect(tuples[0]?.checkpoint.channel_values).toEqual({ [TASKS]: ["send-1", "send-2", "send-3"] })
    })

    it("deletes one thread and leaves the other", async () => {
        const saver = await build()
        const update: CheckpointMetadata = { source: "update", step: -1, parents: {} }
        await saver.put(at("1", ""), emptyCheckpoint(), update, {})
        await saver.put(at("2", ""), emptyCheckpoint(), update, {})

        await saver.deleteThread("1")

        expect(await saver.getTuple(at("1", ""))).toBeUndefined()
        expect(await saver.getTuple(at("2", ""))).toBeDefined()
    })
})

/** One row of the kit's list matrix; `before` names a seeded checkpoint of the first thread's root namespace. */
interface ListCase {
    readonly name: string
    readonly threadId: string | undefined
    readonly namespace: string | undefined
    readonly limit: number | undefined
    readonly before: "parent" | "child" | undefined
    readonly filter: Record<string, unknown> | undefined
}

const THREADS = [undefined, "thread-1", "thread-2", "unknown-thread"]
const BEFORE: ReadonlyArray<ListCase["before"]> = [undefined, "parent", "child"]
const LIST_CASES: Array<ListCase> = THREADS.flatMap((threadId) =>
    [undefined, ...NAMESPACES].flatMap((namespace) =>
        [undefined, 1, 2].flatMap((limit) =>
            BEFORE.flatMap((before) =>
                [undefined, {}, { source: "input" }, { source: "loop" }].map((filter) => ({
                    name: JSON.stringify({ threadId, namespace, limit, before, filter }),
                    threadId,
                    namespace,
                    limit,
                    before,
                    filter,
                })),
            ),
        ),
    ),
)

/** The saver the list cases share, once it is seeded. */
interface Held {
    saver?: CheckpointSaverClient
}

describe("conformance: list", () => {
    const stored: Array<CheckpointTuple> = []
    const held: Held = {}

    beforeAll(async () => {
        held.saver = await build()
        for (const threadId of ["thread-1", "thread-2"]) {
            for (const namespace of NAMESPACES) stored.push(...(await seeded(held.saver, threadId, namespace)))
        }
    })

    it.each(LIST_CASES)(
        "returns exactly the matching checkpoints for $name",
        async ({ threadId, namespace, limit, before, filter }) => {
            const saver = held.saver ?? (await build())
            const beforeTuple = before === undefined ? undefined : stored[before === "parent" ? 0 : 1]
            const beforeId = beforeTuple?.checkpoint.id
            const expected = stored
                .filter((tuple) => threadId === undefined || tuple.config.configurable?.thread_id === threadId)
                .filter((tuple) => namespace === undefined || tuple.config.configurable?.checkpoint_ns === namespace)
                .filter((tuple) => beforeId === undefined || tuple.checkpoint.id < beforeId)
                .filter((tuple) =>
                    Object.entries(filter ?? {}).every(
                        ([key, value]) => Reflect.get(tuple.metadata ?? {}, key) === value,
                    ),
                )

            const options = {
                ...(limit === undefined ? {} : { limit }),
                ...(beforeTuple === undefined ? {} : { before: beforeTuple.config }),
                ...(filter === undefined ? {} : { filter }),
            }
            const actual = await listed(saver, at(threadId, namespace), options)

            expect(actual).toHaveLength(limit === undefined ? expected.length : Math.min(limit, expected.length))
            for (const tuple of actual) expect(expected).toContainEqual(tuple)
            expect(new Set(actual.map((tuple) => tuple.checkpoint.id)).size).toBe(actual.length)
        },
    )
})
