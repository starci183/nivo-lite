import { bankFeedDomainBuilder } from "../fixtures/builders/bank-feed-delivery.builder"
import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { BankFeedService, BankFeedDeliveryService } from "@modules/domain/billing"
import { JOB_CLAIMS, JOB_PROCESSOR_REGISTRY } from "@modules/platform/jobs"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import { BankFeedDeliveryQueueModule } from "@features/jobs/bank-feed-delivery"
import type { LiteWorld } from "@tests/world/lite-world.service"
import { jobsBuilder } from "../fixtures/builders/jobs.builder"

/** Composes the real feature and runner over persisted claims; only the downstream domain effect is recorded. */
export const bankFeedDeliveryBuilder = async (world: LiteWorld) => {
    const built = jobsBuilder(world.db.primary, world.key(world.id()))
    const delivery = {
        ...built.delivery,
        queue: BANK_FEED_DELIVERY_QUEUE,
        job: BANK_FEED_DELIVERY_QUEUE,
        payload: { provider: "casso", deliveryId: "connection:delivery-1" },
    }
    const { inbox, service, close } = await bankFeedDomainBuilder(built.claims)
    world.cleanup(close)
    const advance = built.claims.advance.bind(built.claims)
    const claims = { advance: jest.spyOn(built.claims, "advance") }
    const registry = { add: jest.spyOn(built.runner, "add") }
    const moduleRef = await Test.createTestingModule({
        imports: [BankFeedDeliveryQueueModule.register({})],
    })
        .useMocker((dependency) => {
            if (dependency === BankFeedDeliveryService) return service
            if (dependency === BankFeedService) return inbox
            if (dependency === JOB_CLAIMS) return built.claims
            if (dependency === JOB_PROCESSOR_REGISTRY) return built.runner
            return undefined
        })
        .compile()
    await moduleRef.init()
    world.cleanup(() => moduleRef.close())
    const processor = registry.add.mock.calls[0]?.[0]
    assert(processor !== undefined)
    const claim = () =>
        built.claims.claim({
            kind: delivery.queue,
            jobKey: delivery.id,
            payload: delivery.payload,
            workerId: "worker-1",
            leaseMs: 100,
        })
    // Reclaim twice to retain the original third-fence assertion against a real persisted lease.
    await claim()
    built.clock.advance(101)
    await claim()
    built.clock.advance(101)
    const job = await claim()
    assert(job !== null)
    return { ...built, delivery, processor, inbox, claims, registry, advance, job }
}
