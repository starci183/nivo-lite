import { JOB_START } from "../../../modules/platform/queue/persistence/queue.sql"
import { LAPSE_REDIS_JOB } from "../../fixtures/persistence/redis-proof.sql"
import { worldIds } from "../../world/lite-world.service"
import { redisQueueModules } from "../../world/redis-capabilities.options"
import { redisJobProof, startQueueRelay, transportOf, waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue crash recovery over private Redis and Supabase", () => {
    const world = useTestWorld({ modules: redisQueueModules(`queue-recovery-${worldIds.next()}`) })
    const { rowOf, enqueue } = redisJobProof(world)
    beforeAll(() => {
        startQueueRelay(world)
    })

    it("runs a crash-recovered running row after its durable lease expires", async () => {
        const queue = world.key("recovered")
        const key = `recovered:${world.key("recovered-job")}`
        const row = await enqueue(queue, key)
        const [start] = await world.db.primary.query<Array<{ readonly outcome: string }>>(JOB_START, [
            queue,
            row.id,
            1,
            5,
        ])
        expect(start?.outcome).toBe("started")
        await world.db.primary.query(LAPSE_REDIS_JOB, [row.id])
        const attempts: Array<number> = []
        await transportOf(world).work(
            {
                queue,
                handle: (delivery) => {
                    attempts.push(delivery.attempt)
                    return Promise.resolve()
                },
            },
            1,
        )
        await waitForProof(
            () => rowOf(key),
            (value) => value.state === "done",
        )
        expect(attempts).toEqual([2])
        expect((await rowOf(key)).attempts).toBe(2)
        await waitForProof(
            () => transportOf(world).stateOf(queue, row.id),
            (state) => state === "completed",
        )
    })
})
