import assert from "node:assert/strict"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { QueueError, QueueErrorCode } from "@modules/platform/queue"
import { worldIds } from "../../world/lite-world.service"
import { redisQueueModules } from "../../world/redis-capabilities.options"
import { redisJobProof, startQueueRelay, transportOf, waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue retry-after hints over private Redis and Supabase", () => {
    const world = useTestWorld({ modules: redisQueueModules(`queue-retry-${worldIds.next()}`) })
    const { rowOf, enqueue } = redisJobProof(world)
    beforeAll(() => {
        startQueueRelay(world)
    })

    it("honours a retry-after hint through BullMQ's real backoff strategy", async () => {
        const queue = world.key("hinted")
        const key = `hinted:${world.key("hinted-job")}`
        const clock = world.resolve<Clock>(CLOCK)
        const starts: Array<number> = []
        await transportOf(world).work(
            {
                queue,
                handle: () => {
                    starts.push(clock.now().getTime())
                    return starts.length === 1
                        ? Promise.reject(new QueueError({ code: QueueErrorCode.RetryAfter, params: { seconds: 1 } }))
                        : Promise.resolve()
                },
            },
            1,
        )
        const row = await enqueue(queue, key)
        await waitForProof(
            () => transportOf(world).stateOf(queue, row.id),
            (state) => state === "delayed",
        )
        expect((await rowOf(key)).state).toBe("queued")
        await waitForProof(
            () => rowOf(key),
            (value) => value.state === "done",
            4500,
        )
        const first = starts[0]
        const second = starts[1]
        assert(first !== undefined && second !== undefined)
        expect(second - first).toBeGreaterThanOrEqual(900)
        expect(second - first).toBeLessThan(4500)
        expect(starts).toHaveLength(2)
    })
})
