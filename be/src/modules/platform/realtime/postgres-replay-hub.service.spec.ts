import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PostgresReplayHubService } from "./postgres-replay-hub.service"
import { NOTIFY_CHANNEL, REALTIME_LOCK_CLASS } from "./realtime.contracts"
import { REALTIME_MANAGERS } from "./realtime.decorators"
import type { RealtimeTopic, RealtimeTransaction } from "./realtime.port"
import { LOCK_TOPIC, PUBLISH_EVENT } from "./persistence/realtime.sql"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

/** The hub on a scripted database: every statement answers no rows unless the spec scripts it. */
const build = async () => {
    const em = mockEntityManager()
    em.query.mockResolvedValue([])
    const transactions = fakeTransaction(em)
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresReplayHubService, { provide: REALTIME_MANAGERS, useValue: [em] }],
    }).compile()
    return { hub: moduleRef.get(PostgresReplayHubService), em, transactions }
}

describe("PostgresReplayHubService publish", () => {
    it("takes the topic lock, then writes the frame and notifies in one statement, in a transaction that commits", async () => {
        const { hub, em, transactions } = await build()

        await hub.publish(topicOf("t:pub"), frameOf(1))

        expect(em.query).toHaveBeenNthCalledWith(1, LOCK_TOPIC, [REALTIME_LOCK_CLASS, "t:pub"])
        expect(em.query).toHaveBeenNthCalledWith(2, PUBLISH_EVENT, [
            "t:pub",
            "e-1",
            JSON.stringify(frameOf(1)),
            NOTIFY_CHANNEL,
        ])
        expect(transactions.outcomes).toEqual(["commit"])
    })

    it("writes a frame without a string id with no resume point", async () => {
        const { hub, em } = await build()
        const topic: RealtimeTopic<{ readonly id: number }> = {
            name: "t:numeric",
            accepts: (value: unknown): value is { readonly id: number } => value !== undefined,
        }

        await hub.publish(topic, { id: 7 })

        expect(em.query).toHaveBeenCalledWith(PUBLISH_EVENT, ["t:numeric", null, '{"id":7}', NOTIFY_CHANNEL])
    })

    it("writes inside the transaction the publisher gives, so the frame commits with the publisher write", async () => {
        const { hub, em, transactions } = await build()
        const inside = mock<RealtimeTransaction>()
        inside.query.mockResolvedValue([])

        await hub.publish(topicOf("t:inside"), frameOf(2), inside)

        expect(inside.query).toHaveBeenNthCalledWith(1, LOCK_TOPIC, [REALTIME_LOCK_CLASS, "t:inside"])
        expect(inside.query).toHaveBeenNthCalledWith(2, PUBLISH_EVENT, [
            "t:inside",
            "e-2",
            JSON.stringify(frameOf(2)),
            NOTIFY_CHANNEL,
        ])
        expect(em.query).not.toHaveBeenCalledWith(PUBLISH_EVENT, expect.anything())
        expect(transactions.outcomes).toEqual([])
    })

    it("publishes nothing when the write fails, and says so", async () => {
        const { hub, em, transactions } = await build()
        em.query.mockImplementation((sql: string) =>
            sql === PUBLISH_EVENT ? Promise.reject(new Error("db down")) : Promise.resolve([]),
        )

        await expect(hub.publish(topicOf("t:fail"), frameOf(3))).rejects.toThrow("db down")

        expect(transactions.outcomes).toEqual(["rollback"])
    })
})
