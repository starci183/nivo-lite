import assert from "node:assert/strict"
import { JobRunnerService } from "@modules/platform/jobs"
import type { FencedProcessor } from "@modules/platform/jobs"
import type { CutoverClaim, CutoverQueues, CutoverRow } from "../../fixtures/persistence/queue-cutover.rows"
import { worldIds } from "../../world/lite-world.service"
import type { LiteWorld } from "../../world/lite-world.service"
import { CONTRACT_MIGRATION, EXPAND_MIGRATION, cutoverSandbox } from "../../world/queue-cutover-sandbox.service"
import { redisJobsModules } from "../../world/redis-capabilities.options"
import { startQueueRelay, transportOf, waitForProof } from "../../world/redis-proof.service"
import { seedCutoverOutbox, seedCutoverRaw } from "../../fixtures/builders/cutover-seeds.builder"
import { useTestWorld } from "../../world/use-test-world"
import {
    cutoverRows,
    originalCutoverRows,
    cutoverClaims,
    cutoverQueues,
    lateCutoverSend,
    contractCutoverSend,
    contractEnqueue,
    pgmqAfterContract,
    legacyCutoverMarker,
    legacyAckFence,
    cutoverFunctions,
} from "../../world/queue-cutover-database.service"

/** The seeded scenarios, by name, in a stable order. */
const proofs = (rows: ReadonlyArray<CutoverRow>, state?: string): Array<string> =>
    rows.filter((row) => state === undefined || row.state === state).map((row) => row.proof)

const ordered = (values: ReadonlyArray<string>): Array<string> => values.toSorted((a, b) => a.localeCompare(b))

const rowsOf = (world: LiteWorld): Promise<Array<CutoverRow>> => cutoverRows(world.db.primary)

const claimsOf = (world: LiteWorld): Promise<Array<CutoverClaim>> => cutoverClaims(world.db.primary)

const queuesOf = (world: LiteWorld): Promise<Array<CutoverQueues>> => cutoverQueues(world.db.primary)

/** After the expand migration every message is an outbox row to publish, nothing is left in a job queue and the old consumers are fenced. */
const expectExpanded = async (world: LiteWorld, original: ReadonlyArray<CutoverRow>): Promise<void> => {
    const expanded = await rowsOf(world)
    expect(expanded).toHaveLength(9)
    expect(proofs(expanded, "failed")).toEqual(["dead", "raw-dead"])
    expect(proofs(expanded, "running")).toEqual(["inflight", "raw-done", "raw-inflight"])
    expect(
        expanded.filter((row) => row.state !== "done" && row.state !== "failed").every((row) => row.sent_at === null),
    ).toBe(true)
    expect(expanded.filter((row) => row.state === "running").every((row) => row.run_lease_until instanceof Date)).toBe(
        true,
    )
    expect(await legacyAckFence(world.db.primary)).toEqual([{ body: "select false" }])
    expect(await queuesOf(world)).toEqual([{ pending: 0, archived: 2, event_bus: 1 }])
    expect(expanded.filter((row) => original.some((before) => before.id === row.id)).map((row) => row.id)).toEqual(
        original.map((row) => row.id),
    )
}

/** Work sent by a not yet drained producer lands in the outbox, and the raw ticks keep their fenced claims under the new delivery id. */
const expectLateWork = async (world: LiteWorld, original: ReadonlyArray<CutoverClaim>): Promise<void> => {
    await lateCutoverSend(world.db.primary)
    await legacyCutoverMarker(world.db.primary)
    const rows = await rowsOf(world)
    expect(rows).toHaveLength(10)
    expect(rows.find((row) => row.proof === "late")).toMatchObject({ state: "queued", sent_at: null })
    expect(await queuesOf(world)).toEqual([{ pending: 0, archived: 2, event_bus: 1 }])
    const adopted = await claimsOf(world)
    expect(adopted.map((row) => row.id)).toEqual(original.map((row) => row.id))
    expect(adopted.map((row) => row.current_step)).toEqual(["preserved-checkpoint", "preserved-checkpoint"])
    const raw = rows.filter((row) => row.proof === "raw-inflight" || row.proof === "raw-done").map((row) => row.id)
    expect(ordered(adopted.map((row) => row.job_key))).toEqual(ordered(raw))
}

/** The contract migration drops the legacy functions and every pgmq job queue: a late legacy send is refused, a producer on the outbox still lands its work and the event bus stays. */
const expectContracted = async (world: LiteWorld): Promise<void> => {
    const before = await rowsOf(world)
    expect(await cutoverFunctions(world.db.primary)).toEqual([{ legacy_read: null, legacy_ack: null }])
    await expect(contractCutoverSend(world.db.primary)).rejects.toThrow()
    expect(await pgmqAfterContract(world.db.primary)).toEqual([{ queues: ["cutover_bus_events"] }])
    await contractEnqueue(world.db.primary)
    const after = await rowsOf(world)
    expect(after).toHaveLength(11)
    expect(after.find((row) => row.proof === "late-contract")).toMatchObject({ state: "queued", sent_at: null })
    expect(after.map((row) => row.id)).toEqual(expect.arrayContaining(before.map((row) => row.id)))
}

/** The real relay publishes every outbox row under its id and a real BullMQ worker runs the fenced processor for each of them. */
const processAll = async (world: LiteWorld, processed: Array<string>, failed: Array<string>): Promise<void> => {
    const processor: FencedProcessor = {
        queue: "content_tick",
        process: (job) => {
            assert("proof" in job.payload && typeof job.payload.proof === "string")
            processed.push(job.payload.proof)
            return Promise.resolve()
        },
        onFailed: (delivery) => {
            failed.push(delivery.id)
            return Promise.resolve()
        },
    }
    const runner = world.resolve(JobRunnerService)
    await transportOf(world).work({ queue: "content_tick", handle: (delivery) => runner.run(processor, delivery) }, 2)
    startQueueRelay(world)
    await waitForProof(
        () => rowsOf(world),
        (rows) => rows.every((row) => row.state === "done" || row.state === "failed"),
        20000,
    )
}

describe("Queue pgmq to BullMQ cutover (private local Supabase and Redis)", () => {
    const sandbox = cutoverSandbox()
    const world = useTestWorld({ modules: redisJobsModules(`cutover-${worldIds.next()}`, 5000), sandbox })
    beforeAll(async () => {
        await seedCutoverOutbox(world.db.primary)
        await seedCutoverRaw(world.db.primary)
    })

    it("migrates queued, in-flight and archived work before dropping legacy functions, preserving identities and fenced progress", async () => {
        const originalClaims = await claimsOf(world)
        const originalRows = await originalCutoverRows(world.db.primary)
        const processed: Array<string> = []
        const failed: Array<string> = []

        await sandbox.apply(EXPAND_MIGRATION)
        await expectExpanded(world, originalRows)
        await expectLateWork(world, originalClaims)
        await sandbox.apply(CONTRACT_MIGRATION)
        await expectContracted(world)
        const beforeReplay = await rowsOf(world)
        await processAll(world, processed, failed)

        const settled = await rowsOf(world)
        expect(ordered(processed)).toEqual([
            "inflight",
            "late",
            "late-contract",
            "outbox-only",
            "queued",
            "raw",
            "raw-inflight",
        ])
        expect(failed).toEqual([])
        expect(proofs(settled, "failed")).toEqual(["dead", "raw-dead"])
        expect(settled.filter((row) => row.state === "done")).toHaveLength(9)
        expect(settled.map((row) => row.id)).toEqual(beforeReplay.map((row) => row.id))
        expect(await claimsOf(world)).toEqual([
            expect.objectContaining({ id: originalClaims[0]?.id, status: "done", fencing_token: "1" }),
            expect.objectContaining({
                id: originalClaims[1]?.id,
                status: "done",
                fencing_token: "2",
                current_step: "preserved-checkpoint",
            }),
        ])
        expect(await pgmqAfterContract(world.db.primary)).toEqual([{ queues: ["cutover_bus_events"] }])
    }, 90000)
})
