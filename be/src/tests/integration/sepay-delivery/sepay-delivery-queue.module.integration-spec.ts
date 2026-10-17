import { JOB_PROCESSOR_REGISTRY } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SEPAY_DELIVERY_QUEUE } from "@modules/queues/sepay-delivery"
import { SepayDeliveryQueueModule } from "../../../features/jobs/sepay-delivery/transport/queue/sepay-delivery-queue.module"
import { SepayDeliveryProcessor } from "../../../features/jobs/sepay-delivery/transport/queue/sepay-delivery.processor"
import { useTestWorld } from "../../world/use-test-world"
import { RECEIPT_DELIVERY_MODULES } from "../../world/zalo-delivery-proof.service"

describe("SepayDeliveryQueueModule", () => {
    const world = useTestWorld({ modules: [...RECEIPT_DELIVERY_MODULES, SepayDeliveryQueueModule.register({})] })
    afterEach(() => jest.restoreAllMocks())
    it("registers its processor with the composed job runner", () => {
        const registry = world.resolve<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)
        const add = jest.spyOn(registry, "add")
        world.resolve(SepayDeliveryQueueModule).onModuleInit()
        expect(add).toHaveBeenCalledWith(world.resolve(SepayDeliveryProcessor))
        const registered = add.mock.calls.map(([processor]) => processor)
        expect(registered.map((processor) => processor.queue)).toEqual([SEPAY_DELIVERY_QUEUE])
    })
})
