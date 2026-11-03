import { Global, Module } from "@nestjs/common"
import { CommandBus, CommandHandler } from "@nestjs/cqrs"
import type { ICommandHandler } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CqrsModule } from "@modules/platform/cqrs"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OPTIONS, QUEUE_TRANSPORT } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { QueueWorkerService } from "./queue-worker.service"

class SeedCommand {
    readonly type = "seed"
}

@CommandHandler(SeedCommand)
class SeedHandler implements ICommandHandler<SeedCommand, string> {
    execute(): Promise<string> {
        return Promise.resolve("seeded")
    }
}

const options = { enabled: true, concurrency: 1 } as QueueOptions

/** What the first worker finds when it starts: it runs a command, as every job handler does. */
const bootWith = async (gated: boolean): Promise<Array<string>> => {
    const transport = mock<QueueTransport>()
    const found: Array<string> = []
    const commands: { bus?: CommandBus } = {}
    transport.work.mockImplementation(async () => {
        try {
            found.push(await commands.bus!.execute(new SeedCommand()))
        } catch {
            found.push("no handler")
        }
    })
    // A global queue module added before the CQRS module: Nest runs the bootstrap hooks of global modules in the order they were added.
    @Global()
    @Module({
        providers: [
            SeedHandler,
            QueueWorkerService,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
        exports: [QueueWorkerService],
    })
    class QueueHost {}
    const moduleRef = await Test.createTestingModule({
        imports: [QueueHost, CqrsModule.register({ isGlobal: true })],
    }).compile()
    commands.bus = moduleRef.get(CommandBus)
    const workers = moduleRef.get(QueueWorkerService)
    workers.add({ queue: "q", handle: () => Promise.resolve() })
    if (!gated) Reflect.set(workers, "cqrs", null)
    await moduleRef.init()
    await moduleRef.close()
    return found
}

describe("queue consumers at boot", () => {
    it("start only after the command handlers are registered, even from a module Nest bootstraps before the CQRS module", async () => {
        await expect(bootWith(true)).resolves.toEqual(["seeded"])
    })

    it("would run a job before its handler exists without the gate", async () => {
        await expect(bootWith(false)).resolves.toEqual(["no handler"])
    })
})
