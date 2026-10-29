import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PostgresReplayHubService } from "./postgres-replay-hub.service"
import { NOTIFY_CHANNEL, REALTIME_LOCK_NAMESPACE, REPLAY_FRAMES } from "./realtime.contracts"
import { REALTIME_MANAGERS } from "./realtime.decorators"
import type { RealtimeTopic } from "./realtime.port"
import { RealtimeEventEntity } from "./persistence/entities"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

const LOCK = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"
const NOTIFY = "SELECT pg_notify($1, $2)"

/** The hub on a scripted database: the lock and the notification answer no rows, the insert answers the sequence number the spec names. */
const build = async (insert: QueryBuilderAnswers = { execute: { raw: [{ seq: "12" }] } }) => {
    const em = mockEntityManager()
    em.query.mockResolvedValue([])
    const fake = fakeQueryBuilder(insert)
    em.createQueryBuilder.mockReturnValue(fake.builder as never)
    const transactions = fakeTransaction(em)
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresReplayHubService, { provide: REALTIME_MANAGERS, useValue: [em] }],
    }).compile()
    return { hub: moduleRef.get(PostgresReplayHubService), em, fake, transactions }
}

describe("PostgresReplayHubService publish", () => {
    it("takes the topic lock, writes the frame, then notifies the row it wrote, in a transaction that commits", async () => {
        const { hub, em, fake, transactions } = await build()

        await hub.publish(topicOf("t:pub"), frameOf(1))

        expect(em.query).toHaveBeenNthCalledWith(1, LOCK, [`${REALTIME_LOCK_NAMESPACE}t:pub`])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RealtimeEventEntity, "e")
        expect(fake.callsOf("insert")).toEqual([[]])
        expect(fake.callsOf("values")).toEqual([[{ topic: "t:pub", eventId: "e-1", payload: frameOf(1) }]])
        expect(fake.callsOf("returning")).toEqual([["seq"]])
        expect(em.query).toHaveBeenNthCalledWith(2, NOTIFY, [NOTIFY_CHANNEL, '{"topic":"t:pub","seq":12}'])
        expect(transactions.outcomes).toEqual(["commit"])
    })

    it("writes a frame without a string id with no resume point", async () => {
        const { hub, fake } = await build()
        const topic: RealtimeTopic<{ readonly id: number }> = {
            name: "t:numeric",
            accepts: (value: unknown): value is { readonly id: number } => value !== undefined,
        }

        await hub.publish(topic, { id: 7 })

        expect(fake.callsOf("values")).toEqual([[{ topic: "t:numeric", eventId: null, payload: { id: 7 } }]])
    })

    it("writes inside the transaction the publisher gives, so the frame commits with the publisher write", async () => {
        const { hub, em, transactions } = await build()
        const inside = mockEntityManager()
        inside.query.mockResolvedValue([])
        const insideFake = fakeQueryBuilder({ execute: { raw: [{ seq: "13" }] } })
        inside.createQueryBuilder.mockReturnValue(insideFake.builder as never)

        await hub.publish(topicOf("t:inside"), frameOf(2), inside)

        expect(inside.query).toHaveBeenNthCalledWith(1, LOCK, [`${REALTIME_LOCK_NAMESPACE}t:inside`])
        expect(insideFake.callsOf("values")).toEqual([[{ topic: "t:inside", eventId: "e-2", payload: frameOf(2) }]])
        expect(inside.query).toHaveBeenNthCalledWith(2, NOTIFY, [NOTIFY_CHANNEL, '{"topic":"t:inside","seq":13}'])
        expect(em.query).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(transactions.outcomes).toEqual([])
    })

    it("publishes nothing when the write fails, and says so", async () => {
        const { hub, em, transactions } = await build({ execute: () => Promise.reject(new Error("db down")) })

        await expect(hub.publish(topicOf("t:fail"), frameOf(3))).rejects.toThrow("db down")

        expect(em.query).not.toHaveBeenCalledWith(NOTIFY, expect.anything())
        expect(transactions.outcomes).toEqual(["rollback"])
    })
})

/** The hub over a manager whose query builders answer the given terminals, in the order of the builders it asks for. */
const buildReads = async (...answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) em.createQueryBuilder.mockReturnValueOnce(fake.builder as never)
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresReplayHubService, { provide: REALTIME_MANAGERS, useValue: [em] }],
    }).compile()
    return { hub: moduleRef.get(PostgresReplayHubService), em, fakes }
}

/** Reaches the protected read the subscriptions start from. */
const replayOf = (hub: PostgresReplayHubService, topic: string, after: string | undefined) =>
    (
        hub as unknown as {
            replay: (topic: string, after: string | undefined) => Promise<{ entries: Array<unknown>; position: string }>
        }
    ).replay(topic, after)

describe("PostgresReplayHubService replay", () => {
    it("notes where a topic stands without reading frames when the client names no frame id", async () => {
        const { hub, em, fakes } = await buildReads({ getRawOne: { seq: "7" } })

        await expect(replayOf(hub, "t:one", undefined)).resolves.toEqual({ entries: [], position: "7" })

        const [read] = fakes
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RealtimeEventEntity, "e")
        expect(read?.callsOf("select")).toEqual([["COALESCE(max(e.seq), 0)", "seq"]])
        expect(read?.callsOf("where")).toEqual([["e.topic = :topic", { topic: "t:one" }]])
    })

    it("replays the newest frames after the frame with the id, oldest first and bounded", async () => {
        const rows = [{ seq: "5", topic: "t:one", payload: { id: "e-5" } }]
        const { hub, fakes } = await buildReads({ getRawOne: { seq: "9" } }, { getRawMany: rows })

        await expect(replayOf(hub, "t:one", "e-4")).resolves.toEqual({
            entries: [{ position: "5", topic: "t:one", frame: { id: "e-5" } }],
            position: "9",
        })

        const [, replay] = fakes
        expect(replay?.callsOf("setParameters")).toEqual([[{ topic: "t:one", afterId: "e-4" }]])
        expect(replay?.callsOf("orderBy")).toEqual([["newest.seq", "ASC"]])
        expect(replay?.callsOf("limit")).toEqual([[REPLAY_FRAMES]])
        const newest = fakeQueryBuilder()
        const subquery = replay?.callsOf("innerJoin")[0]?.[0] as (builder: object) => unknown
        subquery(newest.builder)
        expect(newest.callsOf("from")).toEqual([[RealtimeEventEntity, "e"]])
        expect(newest.callsOf("where")[0]?.[0]).toContain("e.seq > COALESCE((SELECT max(x.seq)")
        expect(newest.callsOf("orderBy")).toEqual([["e.seq", "DESC"]])
        expect(newest.callsOf("limit")).toEqual([[REPLAY_FRAMES]])
    })
})
