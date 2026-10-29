import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { QUEUE_OPTIONS, QUEUE_TIMEOUT, QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { QueueRelayService } from "./queue-relay.service"
import type { QueueTimeout, QueueTimeoutCallback } from "./queue-timeout.port"
import type { QueueTransport, QueueTransportState } from "./queue-transport.port"
import type { QueueReconcileRow, QueueRelayRow } from "./persistence/queue.rows"

const ROW: QueueRelayRow = {
    id: "row-1",
    queue: "knowledge",
    name: "knowledge.index",
    payload: { sourceId: "s-1" },
    lease_token: "relay-1",
    retry_requested: false,
}
const REPAIR: QueueReconcileRow = { ...ROW, state: "queued", attempts: 1, run_token: "run-1" }
const options: QueueOptions = {
    enabled: true,
    redisHost: "redis.invalid",
    redisPort: 6379,
    redisDb: 0,
    prefix: "proof",
    concurrency: 1,
    workspaceConcurrency: 1,
    relayIntervalMs: 2,
    relayBatch: 50,
    reconcileAfterMs: 15_000,
    visibilityTimeoutMs: 30_000,
    shutdownGraceMs: 100,
    schedulers: [],
}
const nap = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
interface RelayWorld {
    relay: QueueRelayService
    em: MockEntityManager
    transport: ReturnType<typeof mock<QueueTransport>>
    logger: ReturnType<typeof mock<Logger>>
    timeout: ReturnType<typeof mock<QueueTimeout>>
    cancel: jest.Mock
    deadlines: Array<QueueTimeoutCallback>
    answerFor: (sql: unknown) => Promise<unknown>
}

/** Bounded claim answers and producer-state doubles; the network never executes in a database transaction. */
const build = async (
    claims: Array<ReadonlyArray<QueueRelayRow>> = [[]],
    repairs: ReadonlyArray<QueueReconcileRow> = [],
    states: Readonly<Record<string, QueueTransportState>> = {},
    overrides: Partial<QueueOptions> = {},
): Promise<RelayWorld> => {
    const em = mockEntityManager()
    const transport = mock<QueueTransport>()
    const logger = mock<Logger>()
    const timeout = mock<QueueTimeout>()
    const cancel = jest.fn()
    const deadlines: Array<QueueTimeoutCallback> = []
    timeout.schedule.mockImplementation((callback) => {
        deadlines.push(callback)
        return cancel
    })
    let pass = 0
    let checked = false
    const answerFor = (sql: unknown): Promise<unknown> => {
        const text = String(sql)
        if (text.includes("job_relay_claim")) return Promise.resolve(claims[pass++] ?? [])
        if (text.includes("job_reconcile")) {
            const rows = checked ? [] : repairs
            checked = true
            return Promise.resolve(rows)
        }
        if (text.includes("job_reset")) return Promise.resolve([{ job_reset: true }])
        return Promise.resolve([])
    }
    em.query.mockImplementation(answerFor)
    transport.add.mockResolvedValue(undefined)
    transport.republish.mockResolvedValue(undefined)
    transport.stateOf.mockImplementation((_queue, id) => Promise.resolve(states[id] ?? "waiting"))
    transport.wait.mockImplementation(nap)
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueRelayService,
            { provide: QUEUE_OPTIONS, useValue: { ...options, ...overrides } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: LOGGER, useValue: logger },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
        ],
    }).compile()
    return { relay: moduleRef.get(QueueRelayService), em, transport, logger, timeout, cancel, deadlines, answerFor }
}
const run = async (world: RelayWorld): Promise<void> => {
    world.relay.onApplicationBootstrap()
    await nap(15)
    await world.relay.onApplicationShutdown()
}
const calls = (world: RelayWorld, name: string): Array<ReadonlyArray<unknown>> =>
    world.em.query.mock.calls.filter(([sql]) => String(sql).includes(name))

describe("outbox relay", () => {
    it("commits a leased claim before publishing and fences the sent mark by its token", async () => {
        const world = await build([[ROW]])
        await run(world)
        expect(world.em.transaction).not.toHaveBeenCalled()
        expect(world.transport.add).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })
        expect(calls(world, "job_relay_claim")[0]?.[1]).toEqual([50, 60])
        expect(calls(world, "job_relay_sent")[0]?.[1]).toEqual(["row-1", "relay-1", 15])
        expect(world.cancel).toHaveBeenCalled()
    })
    it("explicitly republishes an operator retry instead of adding over a retained failed id", async () => {
        const world = await build([[{ ...ROW, retry_requested: true }]])
        await run(world)
        expect(world.transport.add).not.toHaveBeenCalled()
        expect(world.transport.republish).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", ROW.payload)
    })
    it("isolates publish failures and retries the same identity after an expired claim", async () => {
        const next = { ...ROW, id: "row-2", lease_token: "relay-2" }
        const world = await build([[ROW, next], [ROW]])
        world.transport.add.mockRejectedValueOnce(new Error("Redis unavailable"))
        await run(world)
        expect(world.transport.add.mock.calls.map(([, , id]) => id)).toEqual(["row-1", "row-2", "row-1"])
        expect(world.logger.error).toHaveBeenCalledWith(QueueLogEvent.RelayFailed, expect.any(Error), {
            queue: "knowledge",
            jobId: "row-1",
        })
    })
    it("logs a claim failure and still reconciles due rows", async () => {
        const world = await build([[]], [REPAIR])
        world.em.query.mockRejectedValueOnce(new Error("database claim unavailable"))
        await run(world)
        expect(world.logger.error).toHaveBeenCalledWith(QueueLogEvent.RelayFailed, expect.any(Error), {
            outbox: "queue",
        })
        expect(world.transport.stateOf).toHaveBeenCalled()
    })
    it("logs a reconcile claim failure and resumes on the next pass", async () => {
        const world = await build()
        let refused = false
        world.em.query.mockImplementation((sql) => {
            if (String(sql).includes("job_reconcile") && !refused) {
                refused = true
                return Promise.reject(new Error("reconcile unavailable"))
            }
            return world.answerFor(sql)
        })
        await run(world)
        expect(world.logger.error).toHaveBeenCalledWith(QueueLogEvent.ReconcileFailed, expect.any(Error))
        expect(world.transport.wait).toHaveBeenCalled()
    })
    it("leaves producers disconnected when queue consumption is disabled", async () => {
        const world = await build([[ROW]], [], {}, { enabled: false })
        await run(world)
        expect(world.em.query).not.toHaveBeenCalled()
        expect(world.transport.add).not.toHaveBeenCalled()
    })
})

describe("due reconciliation", () => {
    it.each(["missing", "failed", "completed"] as const)(
        "replays a nonterminal %s job through the fenced handler",
        async (state) => {
            const world = await build([[]], [REPAIR], { "row-1": state })
            await run(world)
            expect(calls(world, "job_reset")[0]?.[1]).toEqual(["row-1", "relay-1", "run-1"])
            expect(world.transport.republish).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", ROW.payload)
            expect(calls(world, "job_done")).toHaveLength(0)
            expect(calls(world, "job_relay_release")[0]?.[1]).toEqual(["row-1", "relay-1"])
        },
    )
    it.each(["waiting", "delayed", "active", "unknown"] as const)(
        "releases a %s check without replaying the job",
        async (state) => {
            const world = await build([[]], [REPAIR], { "row-1": state })
            await run(world)
            expect(world.transport.republish).not.toHaveBeenCalled()
            expect(calls(world, "job_reset")).toHaveLength(0)
            expect(calls(world, "job_relay_release")).toHaveLength(1)
        },
    )
    it.each([{ answer: [] }, { answer: [{ job_reset: false }] }])(
        "does not replay after losing a relay claim or worker admission",
        async ({ answer }) => {
            const world = await build([[]], [REPAIR], { "row-1": "missing" })
            world.em.query.mockImplementation((sql) =>
                String(sql).includes("job_reset") ? Promise.resolve(answer) : world.answerFor(sql),
            )
            await run(world)
            expect(world.transport.republish).not.toHaveBeenCalled()
        },
    )
    it("continues repairing another queue when one row's broker query fails", async () => {
        const world = await build([[]], [REPAIR, { ...REPAIR, id: "row-2", queue: "public_api" }], {
            "row-2": "missing",
        })
        world.transport.stateOf.mockRejectedValueOnce(new Error("lookup failed"))
        await run(world)
        expect(world.transport.republish).toHaveBeenCalledWith("public_api", "knowledge.index", "row-2", ROW.payload)
        expect(world.logger.error).toHaveBeenCalledWith(QueueLogEvent.ReconcileFailed, expect.any(Error), {
            queue: "knowledge",
            jobId: "row-1",
        })
        expect(calls(world, "job_reconcile")[0]?.[1]).toEqual([15, 60, 50, 60])
    })
})

describe("relay shutdown", () => {
    it("does not publish a row returned after shutdown began", async () => {
        const world = await build()
        let answer: (rows: Array<QueueRelayRow>) => void = () => undefined
        world.em.query.mockImplementation(
            () =>
                new Promise((resolve) => {
                    answer = resolve
                }),
        )
        world.relay.onApplicationBootstrap()
        const closing = world.relay.onApplicationShutdown()
        answer([ROW])
        await closing
        expect(world.transport.add).not.toHaveBeenCalled()
        expect(world.transport.stateOf).not.toHaveBeenCalled()
    })
    it("does not start repair for a reconcile batch returned after shutdown", async () => {
        const world = await build()
        let answer: (rows: Array<QueueReconcileRow>) => void = () => undefined
        world.em.query.mockImplementation((sql) =>
            String(sql).includes("job_reconcile")
                ? new Promise((resolve) => {
                      answer = resolve
                  })
                : world.answerFor(sql),
        )
        world.relay.onApplicationBootstrap()
        await nap(1)
        const closing = world.relay.onApplicationShutdown()
        answer([REPAIR])
        await closing
        expect(world.transport.stateOf).not.toHaveBeenCalled()
    })
    it("does not reset or republish after an in-flight broker lookup settles during shutdown", async () => {
        const world = await build([[]], [REPAIR])
        let answer: (state: QueueTransportState) => void = () => undefined
        world.transport.stateOf.mockImplementation(
            () =>
                new Promise((resolve) => {
                    answer = resolve
                }),
        )
        world.relay.onApplicationBootstrap()
        await nap(1)
        const closing = world.relay.onApplicationShutdown()
        answer("missing")
        await closing
        expect(calls(world, "job_reset")).toHaveLength(0)
        expect(world.transport.republish).not.toHaveBeenCalled()
    })
})

describe("relay shutdown deadline", () => {
    it("rejects safely if the deadline scheduler fails", async () => {
        const world = await build()
        let finish: (rows: Array<QueueRelayRow>) => void = () => undefined
        world.em.query.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                }),
        )
        world.timeout.schedule.mockImplementation(() => {
            throw new QueueError({ code: QueueErrorCode.RedisDeadline })
        })
        world.relay.onApplicationBootstrap()
        await expect(world.relay.onApplicationShutdown()).rejects.toMatchObject({ code: QueueErrorCode.RedisDeadline })
        finish([])
        await nap(1)
    })
    it("rejects at the deadline when an external operation never settles", async () => {
        const world = await build()
        let finish: (rows: Array<QueueRelayRow>) => void = () => undefined
        world.em.query.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                }),
        )
        world.relay.onApplicationBootstrap()
        const closing = world.relay.onApplicationShutdown()
        const result = expect(closing).rejects.toMatchObject({ code: QueueErrorCode.ShutdownDeadline })
        world.deadlines[0]?.()
        await result
        expect(world.timeout.schedule).toHaveBeenCalledWith(expect.any(Function), 20_000)
        expect(world.cancel).toHaveBeenCalled()
        finish([])
        await nap(1)
    })
})
