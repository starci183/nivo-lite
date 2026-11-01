import { QueueError, QueueErrorCode } from "@modules/platform/queue"
import { worldIds } from "../../world/lite-world.service"
import { redisQueueModules } from "../../world/redis-capabilities.options"
import {
    redisJobProof,
    startQueueRelay,
    transportOf,
    waitForProof,
    requeueRedisJob,
} from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue operator retry over private Redis and PostgreSQL", () => {
    const world = useTestWorld({ modules: redisQueueModules(`queue-operator-${worldIds.next()}`) })
    const { rowOf, enqueue } = redisJobProof(world)
    beforeAll(() => {
        startQueueRelay(world)
    })

    it("re-runs an operator retry while a failed BullMQ job is retained under its id", async () => {
        const queue = world.key("operator")
        const key = `operator:${world.key("operator-job")}`
        let starts = 0
        await transportOf(world).work(
            {
                queue,
                handle: () => {
                    starts += 1
                    return starts === 1
                        ? Promise.reject(new QueueError({ code: QueueErrorCode.Unrecoverable }))
                        : Promise.resolve()
                },
            },
            1,
        )
        const row = await enqueue(queue, key)
        await waitForProof(
            () => rowOf(key),
            (value) => value.state === "failed",
        )
        await waitForProof(
            () => transportOf(world).stateOf(queue, row.id),
            (state) => state === "failed",
        )
        await requeueRedisJob(world.db.primary, row.id)
        await waitForProof(
            () => rowOf(key),
            (value) => value.state === "done",
        )
        expect(starts).toBe(2)
        expect(await rowOf(key)).toMatchObject({ id: row.id, attempts: 1 })
        await waitForProof(
            () => transportOf(world).stateOf(queue, row.id),
            (state) => state === "completed",
        )
    })
})
