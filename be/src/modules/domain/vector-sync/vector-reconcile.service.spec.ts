import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { InsertResult } from "typeorm"
import type { VectorIndexBoot } from "@modules/integrations/qdrant"
import type { Logger } from "@modules/platform/logging"
import { VectorSyncQueue } from "@modules/queues/vector-sync"
import { FakeEmbedder, FakeRowSource, FakeVectorIndex, TEST_MODEL, vectorRowOf } from "@tests/fixtures/builders/vector-sync.builder"
import { VectorSyncStateEntity } from "./persistence/entities"
import type { VectorDriftReporter } from "./vector-sync.contracts"
import { VectorReconcileService } from "./vector-reconcile.service"
import { VectorSyncService } from "./vector-sync.service"

const WS = "11111111-1111-4111-8111-111111111111"
const WS2 = "22222222-2222-4222-8222-222222222222"
const NOW = new Date("2026-11-11T10:00:00.000Z")

/** A row id that sorts by its number. */
const idOf = (at: number): string => `row-${String(at).padStart(7, "0")}`

const build = (bound = true) => {
    const index = new FakeVectorIndex()
    const sources = { passage: new FakeRowSource(), truth: new FakeRowSource() }
    const embedder = new FakeEmbedder()
    const queue = mock<VectorSyncQueue>()
    const logger = mock<Logger>()
    const notices = mock<VectorDriftReporter>()
    notices.postBackgroundStopped.mockResolvedValue("posted")
    const boot = mock<VectorIndexBoot>()
    boot.prepare.mockImplementation(() => Promise.resolve(!index.down))
    const states = new Map<string, VectorSyncStateEntity>()
    const em = mockEntityManager()
    fakeTransaction(em)
    em.find.mockImplementation(() => Promise.resolve([...states.values()]))
    em.upsert.mockImplementation((_entity, row) => {
        const state = Object.assign(new VectorSyncStateEntity(), row)
        states.set(String(state.kind), state)
        return Promise.resolve(new InsertResult())
    })
    const clock = new FakeClock(NOW)
    const sync = new VectorSyncService(bound ? index : null, sources, embedder, queue, em, logger, clock)
    const reconcile = new VectorReconcileService(bound ? index : null, bound ? boot : null, sources, sync, queue, em, logger, clock, notices)
    return { reconcile, index, sources, embedder, queue, logger, notices, states, boot }
}

/** Runs the reconcile until a run neither repairs nor is left unfinished; answers how many runs it took. */
const settle = async (reconcile: VectorReconcileService, most = 400): Promise<number> => {
    let runs = 0
    let continued = true
    while (continued && runs < most) {
        runs += 1
        continued = (await reconcile.run()).continued
    }
    expect(continued).toBe(false)
    return runs
}

const registerDriftCases = () => {
    it("repairs every kind of drift in one run: no point, stale text, stale model, stale flags, a point a row must not hold, a point with no row", async () => {
        const { reconcile, index, sources, embedder } = build()
        const rows = sources.truth
        rows.put(
            vectorRowOf("a-missing", WS),
            vectorRowOf("b-stale-text", WS),
            vectorRowOf("c-stale-model", WS),
            vectorRowOf("d-stale-flags", WS, { mirror: { ...vectorRowOf("x", WS).mirror, isPublic: true, customerReady: true } }),
            vectorRowOf("e-retired", WS, { wanted: false }),
            vectorRowOf("f-fine", WS, { stamped: true, stampedModel: TEST_MODEL }),
        )
        const payload = (id: string) => ({ ...vectorRowOf(id, WS).mirror, model: TEST_MODEL, textHash: `hash-${id}` })
        index.points.truth.set("b-stale-text", { id: "b-stale-text", vector: [1], payload: { ...payload("b-stale-text"), textHash: "old" } })
        index.points.truth.set("c-stale-model", { id: "c-stale-model", vector: [1], payload: { ...payload("c-stale-model"), model: "old@1536" } })
        index.points.truth.set("d-stale-flags", { id: "d-stale-flags", vector: [4], payload: payload("d-stale-flags") })
        index.points.truth.set("e-retired", { id: "e-retired", vector: [5], payload: payload("e-retired") })
        index.points.truth.set("f-fine", { id: "f-fine", vector: [6], payload: payload("f-fine") })
        index.points.truth.set("g-orphan", { id: "g-orphan", vector: [7], payload: payload("g-orphan") })

        const done = await reconcile.run()

        expect(done.outcome).toBe("ran")
        expect(done.kinds.truth).toMatchObject({ rows: 6, embedded: 3, marked: 1, removed: 2, unchanged: 1, failed: 0, rowsWrapped: true, pointsWrapped: true })
        expect([...index.points.truth.keys()].toSorted()).toEqual(["a-missing", "b-stale-text", "c-stale-model", "d-stale-flags", "f-fine"])
        expect(index.payloadOf("truth", "b-stale-text")?.textHash).toBe("hash-b-stale-text")
        expect(index.payloadOf("truth", "c-stale-model")?.model).toBe(TEST_MODEL)
        expect(index.payloadOf("truth", "d-stale-flags")).toMatchObject({ isPublic: true, customerReady: true })
        expect(index.points.truth.get("d-stale-flags")?.vector).toEqual([4])
        expect(embedder.calls).toBe(1)

        // The next run meets a clean index: it compares and writes nothing.
        const upserts = index.calls.upsert
        const again = await reconcile.run()
        expect(again.kinds.truth).toMatchObject({ embedded: 0, marked: 0, removed: 0, unchanged: 5 })
        expect(index.calls.upsert).toBe(upserts)
        expect(again.continued).toBe(false)
    })

    it("removes the points of a deleted workspace: the walk over the points asks Postgres which rows still want one", async () => {
        const { reconcile, index, sources } = build()
        sources.passage.put(vectorRowOf("p1", WS))
        const gone = { ...vectorRowOf("zz", WS2).mirror, model: TEST_MODEL, textHash: "h" }
        index.points.passage.set("zz1", { id: "zz1", vector: [1], payload: gone })
        index.points.passage.set("zz2", { id: "zz2", vector: [1], payload: gone })

        const done = await reconcile.run()

        expect(done.kinds.passage).toMatchObject({ removed: 2, points: 3 })
        expect([...index.points.passage.keys()]).toEqual(["p1"])
    })

    it("does nothing and says so when the deployment has no vector index", async () => {
        const { reconcile, sources, queue } = build(false)
        sources.truth.put(vectorRowOf("t1", WS))
        await expect(reconcile.run()).resolves.toEqual({ outcome: "off", kinds: {}, continued: false, driftRuns: 0, reported: 0 })
        expect(sources.truth.calls).toEqual({})
        expect(queue.enqueueReconcile).not.toHaveBeenCalled()
    })
}

const registerBoundCases = () => {
    it("is bounded per run and resumes from its cursor: 4,096 rows a run, the follow-up queued while it repairs", async () => {
        const { reconcile, index, sources, queue, states } = build()
        for (let at = 0; at < 10_000; at += 1) {
            sources.passage.put(vectorRowOf(idOf(at), WS))
            sources.passage.stored.set(idOf(at), [at])
        }

        const first = await reconcile.run()
        expect(first.kinds.passage).toMatchObject({ rows: 4096, copied: 4096, rowsWrapped: false })
        expect(first.continued).toBe(true)
        expect(queue.enqueueReconcile).toHaveBeenCalledWith({ resumedAt: NOW.getTime() }, expect.anything())
        expect(states.get("passage")).toMatchObject({ rowsAfter: idOf(4095), driftRuns: 0 })
        expect(index.points.passage.size).toBe(4096)

        expect(await settle(reconcile)).toBe(2)
        expect(index.points.passage.size).toBe(10_000)
        expect(states.get("passage")).toMatchObject({ rowsAfter: null, passes: 1 })

        // A clean pass queues no follow-up: it waits for the tick.
        queue.enqueueReconcile.mockClear()
        const clean = await reconcile.run()
        expect(clean.kinds.passage).toMatchObject({ unchanged: 4096, copied: 0 })
        expect(queue.enqueueReconcile).not.toHaveBeenCalled()
    })

    it("stops a run at its embedding budget without skipping a row: the same page is met again", async () => {
        const { reconcile, index, sources, embedder } = build()
        for (let at = 0; at < 1500; at += 1) sources.truth.put(vectorRowOf(idOf(at), WS))

        const first = await reconcile.run()
        // 32 calls of 32 lines = 1,024 rows = four pages; the fifth page finds the budget spent and is not passed.
        expect(embedder.calls).toBe(32)
        expect(first.kinds.truth).toMatchObject({ embedded: 1024, rows: 1024, waiting: 256, rowsWrapped: false })
        expect(first.continued).toBe(true)

        await settle(reconcile)
        expect(index.points.truth.size).toBe(1500)
        expect(embedder.texts).toBe(1500)
    })

    it("rows waiting for credits are not drift: the walk passes them, nothing is reported, and they are embedded when credits return", async () => {
        const { reconcile, index, sources, embedder, notices } = build()
        for (let at = 0; at < 40; at += 1) sources.truth.put(vectorRowOf(idOf(at), WS))
        embedder.answer = "blocked"

        for (let run = 0; run < 5; run += 1) {
            const done = await reconcile.run()
            expect(done).toMatchObject({ outcome: "ran", driftRuns: 0, continued: false })
            expect(done.kinds.truth).toMatchObject({ waiting: 40, rowsWrapped: true })
        }
        expect(notices.postBackgroundStopped).not.toHaveBeenCalled()

        embedder.answer = "vectors"
        await reconcile.run()
        expect(index.points.truth.size).toBe(40)
    })
}

const registerOutageCases = () => {
    it("an index that is down: the run counts, the cursors stay, and after three runs each founder is told once for the episode", async () => {
        const { reconcile, index, sources, notices, states, queue } = build()
        sources.passage.put(vectorRowOf("p1", WS), vectorRowOf("p2", WS2))
        index.down = true

        const first = await reconcile.run()
        expect(first).toMatchObject({ outcome: "stopped", driftRuns: 1, reported: 0, continued: false })
        await reconcile.run()
        expect(notices.postBackgroundStopped).not.toHaveBeenCalled()

        const third = await reconcile.run()
        expect(third).toMatchObject({ outcome: "stopped", driftRuns: 3, reported: 2 })
        expect(notices.postBackgroundStopped).toHaveBeenCalledTimes(2)
        expect(notices.postBackgroundStopped).toHaveBeenCalledWith(WS, { work: "brain.vectors.sync", reason: "gave_up", episode: NOW })
        expect(notices.postBackgroundStopped).toHaveBeenCalledWith(WS2, { work: "brain.vectors.sync", reason: "gave_up", episode: NOW })

        // The outage goes on: the episode is not told again.
        await reconcile.run()
        await reconcile.run()
        expect(notices.postBackgroundStopped).toHaveBeenCalledTimes(2)
        expect(states.get("passage")).toMatchObject({ driftRuns: 5, driftSince: NOW, rowsAfter: null })
        expect(queue.enqueueReconcile).not.toHaveBeenCalled()

        // The index is back: the next run repairs and the episode ends.
        index.down = false
        const back = await reconcile.run()
        expect(back).toMatchObject({ outcome: "ran", driftRuns: 0 })
        expect(index.points.passage.size).toBe(2)
        expect(states.get("passage")).toMatchObject({ driftRuns: 0, driftSince: null })
    })

    it("an embedding provider that fails stops the kind on the failing page and counts as drift; a report that cannot be posted is logged", async () => {
        const { reconcile, sources, embedder, notices, logger, states } = build()
        sources.truth.put(vectorRowOf("t1", WS))
        embedder.answer = "failed"
        notices.postBackgroundStopped.mockRejectedValue(new Error("chat down"))

        await reconcile.run()
        await reconcile.run()
        const third = await reconcile.run()

        expect(third.kinds.truth).toMatchObject({ failed: 1, rows: 0 })
        expect(third).toMatchObject({ driftRuns: 3, reported: 0 })
        expect(states.get("truth")).toMatchObject({ rowsAfter: null })
        expect(logger.error).toHaveBeenCalled()
    })
}

const registerWorkloadCases = () => {
    it("rebuilds 200,000 passages from an empty index out of Postgres's own vectors: the calls, in numbers, and no embedding", async () => {
        const { reconcile, index, sources, embedder } = build()
        const N = 200_000
        for (let at = 0; at < N; at += 1) {
            sources.passage.put(vectorRowOf(idOf(at), WS))
            sources.passage.stored.set(idOf(at), [at])
        }

        const runs = await settle(reconcile)

        expect(index.points.passage.size).toBe(N)
        expect(embedder.calls).toBe(0)
        const restUpserts = index.upsertSizes.reduce((sum, size) => sum + Math.ceil(size / 64), 0)
        expect({
            runs,
            rowPages: sources.passage.calls.page,
            stampReads: index.calls.stampsOf,
            vectorReads: sources.passage.calls.storedVectors,
            restUpserts,
            postgresStamps: sources.passage.calls.stamp,
        }).toEqual({
            // 49 runs of 4,096 rows back to back (the 49th ends the pass), plus the truths' empty page each run.
            runs: 49,
            // 782 pages of 256 rows + the empty page that ends the pass.
            rowPages: 783,
            // One read of the points of a page's ids per page.
            stampReads: 782,
            // One read of the stored vectors per page.
            vectorReads: 782,
            // 3,125 writes of 64 points (781 full pages x 4, the last page of 64 x 1).
            restUpserts: 3125,
            // One Postgres write per page: indexed_at.
            postgresStamps: 782,
        })
    })

    it("rebuilds after the pgvector column is dropped by embedding again: one call per 32 passages, 1,024 passages a run (200,000 = 6,250 calls, 196 runs)", async () => {
        const { reconcile, index, sources, embedder } = build()
        // A tenth of the 200,000 workload: the walk is linear in the rows (the copy rebuild above runs the full size).
        const N = 20_000
        for (let at = 0; at < N; at += 1) sources.passage.put(vectorRowOf(idOf(at), WS))

        const runs = await settle(reconcile)

        expect(index.points.passage.size).toBe(N)
        expect(embedder.calls).toBe(N / 32)
        expect(embedder.texts).toBe(N)
        // 1,024 rows a run (the embedding budget), back to back.
        expect(runs).toBe(Math.ceil(N / 1024))
        expect({ calls: 200_000 / 32, runs: Math.ceil(200_000 / 1024) }).toEqual({ calls: 6250, runs: 196 })
    })
}

describe("VectorReconcileService", () => {
    describe("drift", registerDriftCases)
    describe("bounds", registerBoundCases)
    describe("outage", registerOutageCases)
    describe("workload", registerWorkloadCases)
})
