import { strict as assert } from "node:assert"
import { MODULE_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { AcceptMetaEventQueueModule } from "../.."
import { AcceptMetaEventModule } from "../../accept-meta-event.module"
import { DeliverEventStep } from "../../steps/deliver-event.step"
import { AcceptMetaEventProcessor } from "./accept-meta-event.processor"

const injectionTokens: ReadonlyArray<{ readonly index: number; readonly param: typeof JOB_PROCESSOR_REGISTRY }> =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AcceptMetaEventQueueModule)
const registryInjection = injectionTokens.find(({ index }) => index === 0)
assert.ok(registryInjection, "The queue module must declare its processor registry token")
const JOB_PROCESSOR_REGISTRY: unique symbol = registryInjection.param

describe("AcceptMetaEventQueueModule", () => {
    it("imports the event application and provides its queue processor", () => {
        expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AcceptMetaEventQueueModule)).toEqual([
            AcceptMetaEventModule,
        ])
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AcceptMetaEventQueueModule)).toEqual([
            AcceptMetaEventProcessor,
        ])
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AcceptMetaEventModule)).toEqual([DeliverEventStep])
        expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AcceptMetaEventModule)).toEqual([DeliverEventStep])
    })

    it("registers its exact processor when the module initializes", async () => {
        const registry = mock<JobProcessorRegistry>()
        const processor = mock<AcceptMetaEventProcessor>()
        const step = mock<DeliverEventStep>()
        const moduleRef = await Test.createTestingModule({
            imports: [AcceptMetaEventModule],
            providers: [
                AcceptMetaEventQueueModule,
                { provide: JOB_PROCESSOR_REGISTRY, useValue: registry },
                { provide: AcceptMetaEventProcessor, useValue: processor },
            ],
        })
            .overrideProvider(DeliverEventStep)
            .useValue(step)
            .compile()

        expect(registry.add).not.toHaveBeenCalled()
        await moduleRef.init()

        expect(registry.add.mock.calls).toEqual([[processor]])
        expect(registry.add.mock.calls[0]?.[0]).toBe(processor)
        expect(moduleRef.get(AcceptMetaEventModule)).toBeInstanceOf(AcceptMetaEventModule)
        expect(moduleRef.get(DeliverEventStep)).toBe(step)
    })
})
