import assert from "node:assert/strict"
import type { OnModuleInit } from "@nestjs/common"
import { JOB_PROCESSOR_REGISTRY } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { QUEUE_WORKER_REGISTRY } from "@modules/platform/queue"
import { QUEUE_TRANSPORT } from "../../modules/platform/queue/queue.decorators"
import type { QueueTransport } from "../../modules/platform/queue/queue-transport.port"
import { QueueWorkerService } from "../../modules/platform/queue/queue-worker.service"
import type { LiteWorld } from "./lite-world.service"

/** Captures the actual named processors and the platform's real router without starting any poller. */
export const registerPublicApiProcessors = async (world: LiteWorld, module: OnModuleInit) => {
    const registry = world.resolve<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)
    const workers = world.resolve<QueueWorkerService>(QUEUE_WORKER_REGISTRY)
    const transport = world.resolve<QueueTransport>(QUEUE_TRANSPORT)
    const add = jest.spyOn(registry, "add")
    module.onModuleInit()
    const registered = add.mock.calls.map(([processor]) => processor)
    const processor = registered[0]
    assert(processor !== undefined)
    add.mockRestore()
    const work = jest.spyOn(transport, "work").mockResolvedValue(undefined)
    await workers.onApplicationBootstrap()
    const handler = work.mock.calls[0]?.[0]
    assert(handler !== undefined)
    work.mockRestore()
    return { processor, registered, handler }
}

/** The real processor instances and the platform router used by the proof. */
export type RegisteredPublicApi = Awaited<ReturnType<typeof registerPublicApiProcessors>>
