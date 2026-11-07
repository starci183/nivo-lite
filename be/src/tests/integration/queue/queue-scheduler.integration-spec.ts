import type { QueueDelivery } from "@modules/platform/queue"
import { worldIds } from "../../world/lite-world.service"
import { redisQueueModules } from "../../world/redis-capabilities.options"
import { transportOf, waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

/** How long the proof waits for three fires of a once-a-second scheduler, and how long a removed scheduler must stay silent. */
const POLL_BUDGET_MS = 15_000
const SILENCE_MS = 2500
const SLOTS = 3

describe("Queue scheduler over private Redis and PostgreSQL", () => {
    const world = useTestWorld({ modules: redisQueueModules(`queue-scheduler-${worldIds.next()}`) })

    it(
        "queue/scheduler-fires-once: two workers on one queue run each slot of a repeatable job once, and a removed scheduler stops",
        async () => {
            const queue = world.key("fires")
            const scheduler = world.key("fires-scheduler")
            const seen: Array<string> = []
            const handler = {
                queue,
                job: "scheduled-tick",
                scheduled: true,
                handle: (delivery: QueueDelivery) => {
                    seen.push(delivery.id)
                    return Promise.resolve()
                },
            }
            await transportOf(world).workFires(handler, 1)
            await transportOf(world).workFires(handler, 1)

            await transportOf(world).schedule(
                queue,
                scheduler,
                { pattern: "* * * * * *", tz: "UTC" },
                "scheduled-tick",
                {},
            )
            await waitForProof(
                () => Promise.resolve(seen.length),
                (count) => count >= SLOTS,
                POLL_BUDGET_MS,
            )
            await transportOf(world).unschedule(queue, scheduler)

            // Two workers served the queue, yet no slot was handled twice: every delivery id is its own slot.
            expect(new Set(seen).size).toBe(seen.length)
            const settled = seen.length
            await transportOf(world).wait(SILENCE_MS)
            // One slot may already have been in flight when the scheduler was removed; none follows it.
            expect(seen.length).toBeLessThanOrEqual(settled + 1)
        },
        POLL_BUDGET_MS + SILENCE_MS + 2_500,
    )
})
