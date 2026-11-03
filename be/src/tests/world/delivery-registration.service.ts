import type { JobProcessorRegistry, FencedProcessor } from "@modules/platform/jobs"
import assert from "node:assert/strict"
import type { OnModuleInit } from "@nestjs/common"
import { JOB_PROCESSOR_REGISTRY } from "@modules/platform/jobs"
import { QUEUE_WORKER_REGISTRY } from "@modules/platform/queue"
import type { QueueWorkerRegistry, QueueHandler } from "@modules/platform/queue"
import type { LiteWorld } from "./lite-world.service"

type RegisterDeliveryProcessorResultShape = {
    processor: FencedProcessor
    registered: Array<FencedProcessor>
    handler: QueueHandler
}

/** Records the public module's real registration and retains its actual worker handoff. */
export const registerDeliveryProcessor = (
    world: LiteWorld,
    module: OnModuleInit,
): RegisterDeliveryProcessorResultShape => {
    const registry = world.resolve<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)
    const workers = world.resolve<QueueWorkerRegistry>(QUEUE_WORKER_REGISTRY)
    const add = jest.spyOn(registry, "add")
    const subscribe = jest.spyOn(workers, "add")
    module.onModuleInit()
    const registered = add.mock.calls.map(([processor]) => processor)
    const processor = registered[0]
    const handler = subscribe.mock.calls[0]?.[0]
    assert(processor !== undefined && handler !== undefined)
    add.mockRestore()
    subscribe.mockRestore()
    return { processor, registered, handler }
}

/** The actual instances captured at the module and worker registry boundaries. */
export type RegisteredDelivery = ReturnType<typeof registerDeliveryProcessor>
