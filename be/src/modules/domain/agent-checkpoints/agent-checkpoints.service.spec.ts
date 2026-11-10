import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { advisoryLockAnswers } from "@tests/fixtures/builders/advisory-lock.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { CheckpointBlobRow, CheckpointRow, CheckpointWriteRow } from "@modules/integrations/langgraph"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentCheckpointsService } from "./agent-checkpoints.service"
import { AgentCheckpointBlobEntity, AgentCheckpointEntity, AgentCheckpointWriteEntity } from "./persistence/entities"

const SHOP = "0b5d1c1e-6f0a-4c56-9d5e-0d3f4a1b2c01"
const BYTES = Buffer.from("{}")
const ROW: CheckpointRow = {
    workspaceId: SHOP,
    threadId: "run-1",
    namespace: "",
    checkpointId: "c-2",
    parentCheckpointId: "c-1",
    type: "json",
    payload: BYTES,
    metadata: { source: "loop", step: 1, parents: {} },
}
const BLOB: CheckpointBlobRow = {
    workspaceId: SHOP,
    threadId: "run-1",
    namespace: "",
    channel: "steps",
    version: "2",
    type: "json",
    payload: BYTES,
}
const WRITE: CheckpointWriteRow = {
    workspaceId: SHOP,
    threadId: "run-1",
    namespace: "",
    checkpointId: "c-2",
    taskId: "task-1",
    idx: 0,
    channel: "steps",
    type: "json",
    payload: BYTES,
    taskPath: "~pull, ask",
}

/** A stored checkpoint as the manager answers it. */
const checkpointEntity = (fence: number | null): AgentCheckpointEntity =>
    Object.assign(new AgentCheckpointEntity(), {
        workspaceId: SHOP,
        threadId: "run-1",
        checkpointNs: "",
        checkpointId: "c-2",
        parentCheckpointId: "c-1",
        checkpointType: "json",
        checkpoint: BYTES,
        metadata: ROW.metadata,
        fence,
    })

/** A stored channel value as the manager answers it. */
const blobEntity = (channel: string, version: string): AgentCheckpointBlobEntity =>
    Object.assign(new AgentCheckpointBlobEntity(), {
        workspaceId: SHOP,
        threadId: "run-1",
        checkpointNs: "",
        channel,
        version,
        valueType: "json",
        value: BYTES,
    })

/** A stored pending write as the manager answers it. */
const writeEntity = (checkpointId: string, fence: number | null): AgentCheckpointWriteEntity =>
    Object.assign(new AgentCheckpointWriteEntity(), {
        workspaceId: SHOP,
        threadId: "run-1",
        checkpointNs: "",
        checkpointId,
        taskId: "task-1",
        idx: 0,
        channel: "steps",
        valueType: "json",
        value: BYTES,
        taskPath: "~pull, ask",
        fence,
    })

/** What the thread holds when a write arrives: whether another workspace has it, and the newest fences stored. */
interface Held {
    readonly foreign?: boolean
    readonly checkpointFence?: number | null
    readonly writeFence?: number | null
}

const build = async (held: Held = {}) => {
    const entityManager = mockEntityManager({
        query: advisoryLockAnswers,
        exists: [AgentCheckpointEntity, held.foreign ?? false],
        findOne: [
            [AgentCheckpointEntity, held.checkpointFence === undefined ? null : checkpointEntity(held.checkpointFence)],
            [AgentCheckpointWriteEntity, held.writeFence === undefined ? null : writeEntity("c-2", held.writeFence)],
        ],
        find: [
            [AgentCheckpointEntity, [checkpointEntity(1)]],
            [
                AgentCheckpointBlobEntity,
                [blobEntity("steps", "2"), blobEntity("steps", "3"), blobEntity("trigger", "2")],
            ],
            [AgentCheckpointWriteEntity, [writeEntity("c-2", 1), writeEntity("c-9", 1)]],
        ],
        delete: [
            [AgentCheckpointEntity, { affected: 1 }],
            [AgentCheckpointBlobEntity, { affected: 1 }],
            [AgentCheckpointWriteEntity, { affected: 1 }],
        ],
    })
    const tx = fakeTransaction(entityManager)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentCheckpointsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(AgentCheckpointsService), entityManager, tx }
}

describe("AgentCheckpointsService: writes", () => {
    it("stores a checkpoint and its values in one transaction, after the thread's lock and the fence check", async () => {
        const { service, entityManager, tx } = await build({ checkpointFence: 3, writeFence: 2 })
        const [checkpoint, blobs] = queueQueryBuilders(entityManager, [{ execute: {} }, { execute: {} }])

        const stored = await service.put(ROW, [BLOB], { fence: 3 })

        expect(stored).toBe("stored")
        expect(tx.outcomes).toEqual(["commit"])
        expect(checkpoint?.callsOf("values")[0]?.[0]).toMatchObject({
            workspaceId: SHOP,
            threadId: "run-1",
            checkpointNs: "",
            checkpointId: "c-2",
            parentCheckpointId: "c-1",
            fence: 3,
        })
        expect(checkpoint?.callsOf("orUpdate")).toEqual([
            [
                ["checkpoint_type", "checkpoint", "metadata", "fence"],
                ["thread_id", "checkpoint_ns", "checkpoint_id"],
            ],
        ])
        expect(checkpoint?.callsOf("setParameter")).toEqual([["metadata", JSON.stringify(ROW.metadata)]])
        expect(blobs?.callsOf("values")[0]?.[0]).toEqual([
            {
                workspaceId: SHOP,
                threadId: "run-1",
                checkpointNs: "",
                channel: "steps",
                version: "2",
                valueType: "json",
                value: BYTES,
                fence: 3,
            },
        ])
        expect(blobs?.callsOf("orIgnore")).toEqual([[]])
    })

    it.each([
        ["a newer fence is stored on a checkpoint", { checkpointFence: 4 }, 3, "fenced"],
        ["a newer fence is stored on a pending write", { checkpointFence: 1, writeFence: 4 }, 3, "fenced"],
        ["the writer has no fence and a driver wrote", { checkpointFence: 0 }, null, "fenced"],
        ["another workspace holds the thread", { foreign: true }, 9, "foreign"],
    ])("refuses a checkpoint when %s, and writes nothing", async (_name, held, fence, refusal) => {
        const { service, entityManager } = await build(held)

        expect(await service.put(ROW, [BLOB], { fence })).toBe(refusal)
        expect(await service.putWrites([WRITE], "keep", { fence })).toBe(refusal)
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("lets a writer with no fence write a thread no driver wrote", async () => {
        const { service, entityManager } = await build()
        queueQueryBuilders(entityManager, [{ execute: {} }])

        expect(await service.put(ROW, [], { fence: null })).toBe("stored")
        expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})

describe("AgentCheckpointsService: pending writes and deletion", () => {
    it("keeps a task's stored writes, or replaces them for the library's special writes", async () => {
        const { service, entityManager } = await build({ checkpointFence: 1 })
        const [kept, replaced] = queueQueryBuilders(entityManager, [{ execute: {} }, { execute: {} }])

        expect(await service.putWrites([WRITE], "keep", { fence: 1 })).toBe("stored")
        expect(await service.putWrites([WRITE], "replace", { fence: 1 })).toBe("stored")
        expect(await service.putWrites([], "keep", { fence: 1 })).toBe("stored")

        expect(kept?.callsOf("values")[0]?.[0]).toEqual([
            {
                workspaceId: SHOP,
                threadId: "run-1",
                checkpointNs: "",
                checkpointId: "c-2",
                taskId: "task-1",
                idx: 0,
                channel: "steps",
                valueType: "json",
                value: BYTES,
                taskPath: "~pull, ask",
                fence: 1,
            },
        ])
        expect(kept?.callsOf("orIgnore")).toEqual([[]])
        expect(replaced?.callsOf("orUpdate")).toEqual([
            [
                ["channel", "value_type", "value", "task_path", "fence"],
                ["thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"],
            ],
        ])
    })

    it("deletes a thread's rows of the three tables, wherever it is or within one workspace", async () => {
        const { service, entityManager, tx } = await build()

        await service.deleteThread("run-1")
        await service.deleteWorkspaceThread(SHOP, "run-1")

        expect(tx.outcomes).toEqual(["commit", "commit"])
        expect(entityManager.delete).toHaveBeenCalledWith(AgentCheckpointEntity, { threadId: "run-1" })
        expect(entityManager.delete).toHaveBeenCalledWith(AgentCheckpointBlobEntity, {
            workspaceId: SHOP,
            threadId: "run-1",
        })
        expect(entityManager.delete).toHaveBeenCalledTimes(6)
    })
})

describe("AgentCheckpointsService: reads", () => {
    it("reads one checkpoint, or the newest of the namespace, within the workspace", async () => {
        const { service, entityManager } = await build({ checkpointFence: 1 })

        const newest = await service.checkpoint({
            workspaceId: SHOP,
            threadId: "run-1",
            namespace: "",
            checkpointId: null,
        })
        await service.checkpoint({ workspaceId: SHOP, threadId: "run-1", namespace: "", checkpointId: "c-2" })

        expect(newest).toEqual(ROW)
        expect(entityManager.findOne).toHaveBeenNthCalledWith(1, AgentCheckpointEntity, {
            where: { workspaceId: SHOP, threadId: "run-1", checkpointNs: "" },
            order: { checkpointId: "DESC" },
        })
        expect(entityManager.findOne).toHaveBeenNthCalledWith(2, AgentCheckpointEntity, {
            where: { workspaceId: SHOP, threadId: "run-1", checkpointNs: "", checkpointId: "c-2" },
            order: { checkpointId: "DESC" },
        })
    })

    it("answers null when the thread has no checkpoint", async () => {
        const { service } = await build()

        expect(
            await service.checkpoint({ workspaceId: SHOP, threadId: "run-1", namespace: "", checkpointId: null }),
        ).toBeNull()
    })

    it("lists by every condition named, newest first, bounded, always inside the workspace", async () => {
        const { service, entityManager } = await build()
        const [all, narrowed] = queueQueryBuilders(entityManager, [{ getMany: [] }, { getMany: [checkpointEntity(1)] }])

        await service.checkpoints({
            workspaceId: SHOP,
            threadId: null,
            namespace: null,
            checkpointId: null,
            before: null,
            metadata: {},
            limit: 1000,
        })
        const rows = await service.checkpoints({
            workspaceId: SHOP,
            threadId: "run-1",
            namespace: "",
            checkpointId: "c-2",
            before: "c-3",
            metadata: { source: "loop" },
            limit: 2,
        })

        expect(all?.callsOf("where")).toEqual([["c.workspaceId = :workspaceId", { workspaceId: SHOP }]])
        expect(all?.callsOf("andWhere")).toEqual([])
        expect(all?.callsOf("limit")).toEqual([[1000]])
        expect(narrowed?.callsOf("andWhere")).toEqual([
            ["c.threadId = :threadId", { threadId: "run-1" }],
            ["c.checkpointNs = :namespace", { namespace: "" }],
            ["c.checkpointId = :checkpointId", { checkpointId: "c-2" }],
            ["c.checkpointId < :before", { before: "c-3" }],
            ["c.metadata @> CAST(:metadata AS jsonb)", { metadata: '{"source":"loop"}' }],
        ])
        expect(narrowed?.callsOf("orderBy")).toEqual([["c.checkpointId", "DESC"]])
        expect(rows).toEqual([ROW])
    })
})

describe("AgentCheckpointsService: values, pending writes and usage", () => {
    it("answers only the exact channel versions and checkpoints asked, and reads nothing for an empty ask", async () => {
        const { service, entityManager } = await build()

        const blobs = await service.blobs(SHOP, [{ threadId: "run-1", namespace: "", channel: "steps", version: "2" }])
        const writes = await service.writes(SHOP, [{ threadId: "run-1", namespace: "", checkpointId: "c-2" }])

        expect(blobs).toEqual([BLOB])
        expect(writes).toEqual([WRITE])
        expect(await service.blobs(SHOP, [])).toEqual([])
        expect(await service.writes(SHOP, [])).toEqual([])
        expect(entityManager.find).toHaveBeenCalledTimes(2)
    })

    it("counts what a thread holds", async () => {
        const { service } = await build()

        expect(await service.usage(SHOP, "run-1")).toEqual({
            checkpoints: 1,
            blobs: 3,
            writes: 2,
            bytes: 6 * BYTES.byteLength,
        })
    })
})
