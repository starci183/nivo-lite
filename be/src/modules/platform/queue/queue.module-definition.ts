import { defineCapabilityModule } from "@starci/nest-kit"
import { QUEUE_OPTIONS } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<QueueOptions>({
    optionsInjectionToken: QUEUE_OPTIONS,
})
