import { strict as assert } from "node:assert"
import { MODULE_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ConnectionCommandsQueueModule } from "../.."
import { ConnectionCommandsModule } from "../../connection-commands.module"
import { RunCommandStep } from "../../steps/run-command.step"
import { ConnectionCommandsProcessor } from "./connection-commands.processor"

// The jobs public entry exports the decorator, so use the module's actual injection token.
const injectionTokens: ReadonlyArray<{ readonly index: number; readonly param: typeof JOB_PROCESSOR_REGISTRY }> =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ConnectionCommandsQueueModule)
const registryInjection = injectionTokens.find(({ index }) => index === 0)
assert.ok(registryInjection, "The queue module must declare its processor registry token")
const JOB_PROCESSOR_REGISTRY: unique symbol = registryInjection.param

describe("ConnectionCommandsQueueModule", () => {
    it("imports the command application and provides its queue processor", () => {
        expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ConnectionCommandsQueueModule)).toEqual([
            ConnectionCommandsModule,
        ])
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ConnectionCommandsQueueModule)).toEqual([
            ConnectionCommandsProcessor,
        ])
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ConnectionCommandsModule)).toEqual([RunCommandStep])
        expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, ConnectionCommandsModule)).toEqual([RunCommandStep])
    })

    it("registers its exact processor when the module initializes", async () => {
        const registry = mock<JobProcessorRegistry>()
        const processor = mock<ConnectionCommandsProcessor>()
        const step = mock<RunCommandStep>()
        const moduleRef = await Test.createTestingModule({
            imports: [ConnectionCommandsModule],
            providers: [
                ConnectionCommandsQueueModule,
                { provide: JOB_PROCESSOR_REGISTRY, useValue: registry },
                { provide: ConnectionCommandsProcessor, useValue: processor },
            ],
        })
            .overrideProvider(RunCommandStep)
            .useValue(step)
            .compile()

        expect(registry.add).not.toHaveBeenCalled()
        await moduleRef.init()

        expect(registry.add.mock.calls).toEqual([[processor]])
        expect(registry.add.mock.calls[0]?.[0]).toBe(processor)
        expect(moduleRef.get(ConnectionCommandsModule)).toBeInstanceOf(ConnectionCommandsModule)
        expect(moduleRef.get(RunCommandStep)).toBe(step)
    })
})
