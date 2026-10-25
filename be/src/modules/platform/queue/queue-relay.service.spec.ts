import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OPTIONS, QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { QueueRelayService } from "./queue-relay.service"
import type { QueueTransport, QueueTransportState } from "./queue-transport.port"

const WORKSPACE_ROW = { id: "row-1", queue: "knowledge", name: "knowledge.index", payload: { sourceId: "s-1" } }

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

const statementsOf = (em: MockEntityManager): Array<string> => em.query.mock.calls.map(([sql]) => String(sql))

interface RelayWorld {
    relay: QueueRelayService
    em: MockEntityManager
    tx: MockEntityManager
    txQuery: (sql: unknown) => Promise<unknown>
    transport: ReturnType<typeof mock<QueueTransport>>
    logger: ReturnType<typeof mock<Logger>>
}

/** A relay with the durable claim answers of `claims` (one list per pass, then empty) and the broker states of `states`. */
const build = async (
    claims: Array<ReadonlyArray<typeof WORKSPACE_ROW>>,
    states: Readonly<Record<string, QueueTransportState>> = {},
    overrides: Partial<QueueOptions> = {},
): Promise<RelayWorld> => {
    const em = mockEntityManager()
    const tx = mockEntityManager()
    const transport = mock<QueueTransport>()
    const logger = mock<Logger>()
    let pass = 0
    const txQuery = (sql: unknown): Promise<unknown> => {
        const text = String(sql)
        if (text.includes("job_relay_claim")) return Promise.resolve(claims[pass++] ?? [])
        return Promise.resolve([])
    }
    tx.query.mockImplementation(txQuery)
    em.transaction.mockImplementation((...args: Parameters<EntityManager["transaction"]>) => {
        const last = args[args.length - 1]
        return typeof last === "function" ? last(tx) : Promise.resolve()
    })
    em.query.mockImplementation((sql: unknown) => {
        const text = String(sql)
        if (text.includes("job_reconcile")) {
            return Promise.resolve(Object.keys(states).map((id) => ({ ...WORKSPACE_ROW, id, state: "queued" })))
        }
        return Promise.resolve([])
    })
    transport.add.mockResolvedValue(undefined)
    transport.republish.mockResolvedValue(undefined)
    transport.stateOf.mockImplementation((_queue: string, id: string) => Promise.resolve(states[id] ?? "waiting"))
    transport.wait.mockImplementation((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueRelayService,
            { provide: QUEUE_OPTIONS, useValue: { ...options, ...overrides } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { relay: moduleRef.get(QueueRelayService), em, tx, txQuery, transport, logger }
}

const run = async (world: RelayWorld, ms = 30): Promise<void> => {
    world.relay.onApplicationBootstrap()
    await nap(ms)
    await world.relay.onApplicationShutdown()
}

describe("publishing", () => {
    it("hands each committed row to the broker under its durable id and marks the batch sent in the claim's transaction", async () => {
        const world = await build([[WORKSPACE_ROW]])

        await run(world)

        expect(world.transport.add).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })
        const sent = world.tx.query.mock.calls.find(([sql]) => String(sql).includes("job_relay_sent"))
        expect(sent).toBeDefined()
        expect(sent?.[1]).toEqual([["row-1"]])
    })

    it("publishes the row again under the same id when the relay crashed between publish and mark", async () => {
        const world = await build([[WORKSPACE_ROW], [WORKSPACE_ROW]])
        let sentCalls = 0
        world.tx.query.mockImplementation((sql: unknown) => {
            const text = String(sql)
            if (text.includes("job_relay_sent") && sentCalls++ === 0) return Promise.reject(new Error("mark lost"))
            return world.txQuery(sql)
        })

        await run(world, 50)

        const adds = world.transport.add.mock.calls.filter(([, , id]) => id === "row-1")
        expect(adds.length).toBeGreaterThanOrEqual(2)
        expect(world.logger.error).toHaveBeenCalledWith(
            QueueLogEvent.RelayFailed,
            expect.any(Error),
            expect.any(Object),
        )
    })

    it("touches nothing when the consumer side is off", async () => {
        const world = await build([[WORKSPACE_ROW]], {}, { enabled: false })

        await run(world)

        expect(world.em.transaction).not.toHaveBeenCalled()
        expect(world.transport.add).not.toHaveBeenCalled()
    })
})

describe("reconciliation", () => {
    it("republishes a queued row the broker lost, under the same durable id", async () => {
        const world = await build([[]], { "row-1": "missing" })

        await run(world)

        expect(world.transport.republish).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", {
            sourceId: "s-1",
        })
        expect(statementsOf(world.em).some((sql) => sql.includes("job_relay_sent"))).toBe(true)
    })

    it("republishes a queued row the broker still holds as failed", async () => {
        const world = await build([[]], { "row-1": "failed" })

        await run(world)

        expect(world.transport.republish).toHaveBeenCalledWith("knowledge", "knowledge.index", "row-1", {
            sourceId: "s-1",
        })
    })

    it("closes a row the broker shows completed", async () => {
        const world = await build([[]], { "row-1": "completed" })

        await run(world)

        expect(statementsOf(world.em).some((sql) => sql.includes("job_done"))).toBe(true)
        expect(world.transport.republish).not.toHaveBeenCalled()
    })
})
