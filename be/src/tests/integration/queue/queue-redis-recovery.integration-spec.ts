import { callDbFunction } from "../../../modules/platform/database"
import { worldIds } from "../../world/lite-world.service"
import { redisQueueModules } from "../../world/redis-capabilities.options"
import {
    redisJobProof,
    startQueueRelay,
    transportOf,
    waitForProof,
    lapseRedisJob,
} from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue crash recovery over private Redis and PostgreSQL", () => {
    const world = useTestWorld({ modules: redisQueueModules(`queue-recovery-${worldIds.next()}`) })
    const { rowOf, enqueue } = redisJobProof(world)
    beforeAll(() => {
        startQueueRelay(world)
    })

    it("runs a crash-recovered running row after its durable lease expires", async () => {
        const queue = world.key("recovered")
        const key = `recovered:${world.key("recovered-job")}`
        const row = await enqueue(queue, key)
        const [start] = await callDbFunction<{ readonly outcome: string }>(world.db.primary, "public.job_start", [
            queue,
            row.id,
            1,
            5,
        ])
        expect(start?.outcome).toBe("started")
        await lapseRedisJob(world.db.primary, row.id)
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
