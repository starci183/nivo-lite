import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { QUEUE_OPTIONS } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"

/** The configurable-module base of the queues; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<QueueOptions>({
    optionsInjectionToken: QUEUE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    QueueOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: QueueOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
