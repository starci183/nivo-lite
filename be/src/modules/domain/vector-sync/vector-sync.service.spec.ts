import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PLATFORM_TENANT, VECTOR_INDEX, type VectorFlags, type VectorRow } from "@modules/integrations/qdrant"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { VectorSyncQueue } from "@modules/queues/vector-sync"
import { FakeEmbedder, FakeRowSource, FakeVectorIndex, TEST_MODEL, vectorRowOf } from "@tests/fixtures/builders/vector-sync.builder"
import { VECTOR_EMBEDDER, VECTOR_ROW_SOURCES } from "./vector-sync.decorators"
import { VectorSyncService } from "./vector-sync.service"

const WS = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const NOW = new Date("2026-11-11T10:00:00.000Z")
const AT = NOW.getTime()

/** A passage row override: the row fields, with the mirror given in part. */
interface PassageOver extends Partial<Omit<VectorRow, "mirror">> {
    readonly mirror?: Partial<VectorFlags>
}

/** Builds the sync service in a testing module over the scripted index, row sources, embedder, queue and clock. */
const build = async () => {
    const index = new FakeVectorIndex()
    const sources = { passage: new FakeRowSource(), truth: new FakeRowSource(), base: new FakeRowSource() }
    const embedder = new FakeEmbedder()
    const queue = mock<VectorSyncQueue>()
    const logger = mock<Logger>()
    const em = mockEntityManager()
    const transaction = fakeTransaction(em)
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VectorSyncService,
            { provide: VECTOR_INDEX, useValue: index },
            { provide: VECTOR_ROW_SOURCES, useValue: sources },
            { provide: VECTOR_EMBEDDER, useValue: embedder },
            { provide: VectorSyncQueue, useValue: queue },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(VectorSyncService), index, sources, embedder, queue, logger, em, transaction }
}

/** A passage row of a document. */
const passage = (id: string, sourceId: string, over: PassageOver = {}) =>
    vectorRowOf(id, WS, {
        ...over,
        mirror: { workspaceId: WS, sourceId, module: null, installationId: null, isPublic: true, customerReady: false, inForce: true, ...over.mirror },
    })

const registerEventCases = () => {
    it("passage indexed (vector ready): the writer's vectors become points under the row ids, the job is written first, Postgres is stamped after", async () => {
        const { service, index, sources, queue, embedder } = await build()
        sources.passage.put(passage("p1", "doc"), passage("p2", "doc"))

        const done = await service.accept(
            "passage",
            WS,
            new Map([
                ["p1", [0.1, 0.2]],
                ["p2", [0.3, 0.4]],
            ]),
        )

        expect(queue.enqueueSync).toHaveBeenCalledWith({ kind: "passage", workspaceId: WS, ids: ["p1", "p2"], at: AT }, expect.anything())
        expect(done).toMatchObject({ given: 2, embedded: 0, embedCalls: 0 })
        expect(index.points.passage.get("p1")).toEqual({
            id: "p1",
            vector: [0.1, 0.2],
            payload: {
                workspaceId: WS,
                sourceId: "doc",
                module: null,
                installationId: null,
                isPublic: true,
                customerReady: false,
                inForce: true,
                model: TEST_MODEL,
                textHash: "hash-p1",
            },
        })
        expect(sources.passage.rows.get("p2")).toMatchObject({ stamped: true, stampedModel: TEST_MODEL })
        expect(embedder.calls).toBe(0)
    })

    it("document replaced or deleted: the points of passages that are gone are removed, the kept ones are untouched", async () => {
        const { service, index, sources } = await build()
        sources.passage.put(passage("p1", "doc"), passage("p2", "doc"), passage("p3", "doc"), passage("x1", "other"))
        await service.sync({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT })
        await service.sync({ kind: "passage", workspaceId: WS, sourceId: "other", at: AT })
        expect(index.points.passage.size).toBe(4)

        // The document is read again: p2 is gone, p4 is new.
        sources.passage.rows.delete("p2")
        sources.passage.put(passage("p4", "doc"))
        const replaced = await service.sync({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT + 1 })
        expect(replaced).toMatchObject({ removed: 1, embedded: 1, unchanged: 2 })
        expect([...index.points.passage.keys()].toSorted()).toEqual(["p1", "p3", "p4", "x1"])

        // The document is deleted: no row is left, every point of it goes; the other document keeps its point.
        for (const id of ["p1", "p3", "p4"]) sources.passage.rows.delete(id)
        const deleted = await service.sync({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT + 2 })
        expect(deleted).toMatchObject({ removed: 3 })
        expect([...index.points.passage.keys()]).toEqual(["x1"])
    })

    it("passage readiness or audience changed: only the flags are rewritten, in one call per group, with no embedding", async () => {
        const { service, index, sources, embedder } = await build()
        sources.passage.put(passage("p1", "doc"), passage("p2", "doc"))
        await service.sync({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT })
        const calls = embedder.calls

        // The critic releases the document to customers; then the document is switched to internal.
        sources.passage.put(passage("p1", "doc", { mirror: { customerReady: true } }), passage("p2", "doc", { mirror: { customerReady: true } }))
        const released = await service.sync({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT + 1 })
        expect(released).toMatchObject({ marked: 2, embedded: 0, given: 0 })
        expect(index.calls.mark).toBe(1)
        expect(index.payloadOf("passage", "p1")).toMatchObject({ customerReady: true, isPublic: true, textHash: "hash-p1", model: TEST_MODEL })

        sources.passage.put(passage("p1", "doc", { mirror: { isPublic: false } }))
        await service.sync({ kind: "passage", workspaceId: WS, ids: ["p1"], at: AT + 2 })
        expect(index.payloadOf("passage", "p1")).toMatchObject({ isPublic: false, customerReady: false })
        expect(index.points.passage.get("p1")?.vector).toEqual(["text of p1".length, 1])
        expect(embedder.calls).toBe(calls)
    })

}

const registerTruthEventCases = () => {
    it("truth put in force, reach switched, superseded, retired, expired: the point follows the row and goes when the row holds none", async () => {
        const { service, index, sources } = await build()
        const truth = (over: Parameters<typeof vectorRowOf>[2]) => vectorRowOf("t1", WS, over)

        // A proposal is filed: it has a point, not in force (looked up as a candidate only).
        sources.truth.put(truth({ mirror: { ...truth({}).mirror, inForce: false } }))
        await service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })
        expect(index.payloadOf("truth", "t1")).toMatchObject({ inForce: false, customerReady: false })

        // Put in force, public: in force and customer-ready.
        sources.truth.put(truth({ stamped: true, stampedModel: TEST_MODEL, mirror: { ...truth({}).mirror, isPublic: true, customerReady: true } }))
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 1 })).resolves.toMatchObject({ marked: 1 })
        expect(index.payloadOf("truth", "t1")).toMatchObject({ inForce: true, isPublic: true, customerReady: true })

        // Reach switched to internal (the "known to customers" switch off).
        sources.truth.put(truth({ stamped: true, stampedModel: TEST_MODEL }))
        await service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 2 })
        expect(index.payloadOf("truth", "t1")).toMatchObject({ isPublic: false, customerReady: false })

        // Superseded, retired or expired: the row stays in Postgres and wants no point.
        sources.truth.put(truth({ wanted: false }))
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 3 })).resolves.toMatchObject({ removed: 1 })
        expect(index.points.truth.size).toBe(0)

        // The row itself is gone (a deleted workspace's cascade, a hard delete): the point goes too.
        sources.truth.put(truth({}))
        await service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 4 })
        sources.truth.rows.delete("t1")
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 5 })).resolves.toMatchObject({ removed: 1 })
        expect(index.points.truth.size).toBe(0)
    })

    it("every change of a truth writes its job, in its own transaction or the caller's; a change naming no row writes none", async () => {
        const { service, queue, transaction } = await build()
        await service.changed("truth", WS, ["t1", "t1", "t2"])
        expect(queue.enqueueSync).toHaveBeenCalledWith({ kind: "truth", workspaceId: WS, ids: ["t1", "t2"], at: AT }, expect.anything())
        expect(transaction.commits).toBe(1)

        const tx = mockEntityManager()
        await service.changedSource(WS, "doc", tx)
        expect(queue.enqueueSync).toHaveBeenLastCalledWith({ kind: "passage", workspaceId: WS, sourceId: "doc", at: AT }, tx)

        await service.changed("truth", WS, [])
        expect(queue.enqueueSync).toHaveBeenCalledTimes(2)
    })
}

const registerKindCases = () => {
    it("a row kind that declares it is embedded is synced by the same road: the base knowledge, tenant PLATFORM_TENANT", async () => {
        const { service, index, sources, embedder } = await build()
        const item = vectorRowOf("k1", PLATFORM_TENANT, {
            mirror: { workspaceId: PLATFORM_TENANT, sourceId: null, module: null, installationId: null, isPublic: true, customerReady: true, inForce: true },
        })
        sources.base.put(item)

        await expect(service.sync({ kind: "base", workspaceId: PLATFORM_TENANT, ids: ["k1"], at: AT })).resolves.toMatchObject({ embedded: 1 })
        expect(index.payloadOf("base", "k1")).toMatchObject({ workspaceId: PLATFORM_TENANT, model: TEST_MODEL, textHash: "hash-k1" })
        expect(sources.base.rows.get("k1")).toMatchObject({ stamped: true })
        expect(embedder.calls).toBe(1)

        // A workspace's job naming the item's id finds no row of its own tenant and removes nothing.
        await expect(service.sync({ kind: "base", workspaceId: WS, ids: ["k1"], at: AT })).resolves.toMatchObject({ removed: 0 })
        expect(index.points.base.has("k1")).toBe(true)

        // The item is removed from the folder: its point goes.
        sources.base.rows.delete("k1")
        await expect(service.sync({ kind: "base", workspaceId: PLATFORM_TENANT, ids: ["k1"], at: AT + 1 })).resolves.toMatchObject({ removed: 1 })
        expect(index.points.base.size).toBe(0)
    })
}

const registerIdempotenceCases = () => {
    it("replaying a job writes nothing: no upsert, no embedding, no stamp", async () => {
        const { service, index, sources, embedder } = await build()
        sources.truth.put(vectorRowOf("t1", WS), vectorRowOf("t2", WS))
        const job = { kind: "truth" as const, workspaceId: WS, ids: ["t1", "t2"], at: AT }

        await expect(service.sync(job)).resolves.toMatchObject({ embedded: 2, embedCalls: 1 })
        const after = { upsert: index.calls.upsert, embed: embedder.calls, stamp: sources.truth.calls.stamp }

        await expect(service.sync(job)).resolves.toMatchObject({ unchanged: 2, embedded: 0, given: 0, marked: 0, removed: 0 })
        await service.sync(job)
        expect({ upsert: index.calls.upsert, embed: embedder.calls, stamp: sources.truth.calls.stamp }).toEqual(after)
    })

    it("the job that follows a successful hand-over finds the rows in step and spends nothing", async () => {
        const { service, index, sources, embedder } = await build()
        sources.passage.put(passage("p1", "doc"))
        await service.accept("passage", WS, new Map([["p1", [9, 9]]]))

        await expect(service.sync({ kind: "passage", workspaceId: WS, ids: ["p1"], at: AT })).resolves.toMatchObject({ unchanged: 1 })
        expect(index.points.passage.get("p1")?.vector).toEqual([9, 9])
        expect(embedder.calls).toBe(0)
    })

    it("a point keyed by row id + text hash + model: another model or another text is written again, the same is not", async () => {
        const { service, index, sources } = await build()
        sources.truth.put(vectorRowOf("t1", WS))
        await service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })

        const held = index.points.truth.get("t1")
        expect(held).toBeDefined()
        if (held === undefined) return
        index.points.truth.set("t1", { ...held, payload: { ...held.payload, model: "old-model@1536" } })
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 1 })).resolves.toMatchObject({ embedded: 1 })
        expect(index.payloadOf("truth", "t1")?.model).toBe(TEST_MODEL)

        index.points.truth.set("t1", { ...held, payload: { ...held.payload, textHash: "stale" } })
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 2 })).resolves.toMatchObject({ embedded: 1 })
        expect(index.payloadOf("truth", "t1")?.textHash).toBe("hash-t1")
    })

    it("never touches a point of another workspace", async () => {
        const { service, index, sources } = await build()
        sources.truth.put(vectorRowOf("t9", OTHER))
        await service.sync({ kind: "truth", workspaceId: OTHER, ids: ["t9"], at: AT })

        // A job of WS that names the other workspace's row id finds no row of its own and removes nothing.
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t9"], at: AT })).resolves.toMatchObject({ removed: 0 })
        expect(index.points.truth.has("t9")).toBe(true)
    })

    it("drops a payload of another shape", async () => {
        const { service, logger, index } = await build()
        await expect(service.sync({ kind: "passage", workspaceId: WS })).resolves.toMatchObject({ embedded: 0 })
        await expect(service.sync({ kind: "truth", workspaceId: WS, sourceId: "doc", at: AT })).resolves.toMatchObject({ embedded: 0 })
        expect(logger.warn).toHaveBeenCalledTimes(2)
        expect(index.calls).toEqual({})
    })
}

const registerVectorCases = () => {
    it("a vector comes from three origins only, cheapest first: the caller's, another point of the same text, an embedding call", async () => {
        const { service, index, sources, embedder } = await build()
        sources.truth.put(vectorRowOf("t1", WS, { textHash: "line-a" }), vectorRowOf("t2", WS, { textHash: "line-a" }), vectorRowOf("t3", WS))

        // The writer hands over t1's vector: given, no call.
        await expect(service.accept("truth", WS, new Map([["t1", [3, 4]]]))).resolves.toMatchObject({ given: 1, embedCalls: 0 })
        // t2 says the same line: adopted from t1's point; t3 has no donor: embedded.
        const done = await service.sync({ kind: "truth", workspaceId: WS, ids: ["t2", "t3"], at: AT })

        expect(done).toMatchObject({ adopted: 1, embedded: 1, embedCalls: 1 })
        expect(Object.keys(done).toSorted()).toEqual(
            ["adopted", "embedCalls", "embedded", "failed", "given", "marked", "removed", "unchanged", "waiting"].toSorted(),
        )
        expect(index.points.truth.get("t2")?.vector).toEqual([3, 4])
        expect(embedder.calls).toBe(1)
    })

    it("adopts the vector of an identical line's point: one index read, no embedding call", async () => {
        const { service, index, sources, embedder } = await build()
        sources.truth.put(vectorRowOf("t1", WS, { textHash: "same-line" }))
        await service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })
        const calls = embedder.calls

        // A new version keeps its value (a new reach): a new row, the same line.
        sources.truth.put(vectorRowOf("t2", WS, { textHash: "same-line" }))
        await expect(service.adopt("truth", WS, ["t2"])).resolves.toEqual(new Set(["t2"]))

        expect(embedder.calls).toBe(calls)
        expect(index.calls.vectorsOf).toBe(1)
        expect(index.points.truth.get("t2")?.vector).toEqual(index.points.truth.get("t1")?.vector)
        expect(sources.truth.rows.get("t2")).toMatchObject({ stamped: true })

        // A line nobody holds is not adopted: the caller embeds it.
        sources.truth.put(vectorRowOf("t3", WS))
        await expect(service.adopt("truth", WS, ["t3"])).resolves.toEqual(new Set())
        expect(embedder.calls).toBe(calls)
    })

    it("a workspace with no credits waits: nothing is written, nothing fails, and it resumes when credits return", async () => {
        const { service, index, sources, embedder } = await build()
        sources.truth.put(vectorRowOf("t1", WS))
        embedder.answer = "blocked"

        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })).resolves.toMatchObject({ waiting: 1, failed: 0 })
        expect(index.points.truth.size).toBe(0)
        expect(sources.truth.rows.get("t1")?.stamped).toBe(false)

        embedder.answer = "vectors"
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT + 1 })).resolves.toMatchObject({ embedded: 1 })
    })

    it("a failed embedding call writes no point and stamps nothing; an index that is down fails the job so the queue retries", async () => {
        const { service, index, sources, embedder } = await build()
        sources.truth.put(vectorRowOf("t1", WS))
        embedder.answer = "failed"
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })).resolves.toMatchObject({ failed: 1 })
        expect(sources.truth.rows.get("t1")?.stamped).toBe(false)

        index.down = true
        await expect(service.sync({ kind: "truth", workspaceId: WS, ids: ["t1"], at: AT })).rejects.toThrow()
    })

    it("a hand-over the index refuses never fails the writer, stamps nothing, and the queued job repairs it", async () => {
        const { service, index, sources, queue, logger } = await build()
        sources.passage.put(passage("p1", "doc"))
        index.down = true

        await expect(service.accept("passage", WS, new Map([["p1", [1, 1]]]))).resolves.toMatchObject({ failed: 1 })
        expect(queue.enqueueSync).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(sources.passage.rows.get("p1")?.stamped).toBe(false)

        index.down = false
        await expect(service.sync({ kind: "passage", workspaceId: WS, ids: ["p1"], at: AT })).resolves.toMatchObject({ embedded: 1 })
        expect(sources.passage.rows.get("p1")?.stamped).toBe(true)
    })
}

describe("VectorSyncService", () => {
    describe("events", registerEventCases)
    describe("truth events", registerTruthEventCases)
    describe("row kinds", registerKindCases)
    describe("idempotence", registerIdempotenceCases)
    describe("vectors", registerVectorCases)
})
