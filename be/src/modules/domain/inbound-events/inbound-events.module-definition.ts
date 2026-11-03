import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { InboundEventsOptions } from "./inbound-events.options"

/** The configurable-module base of the inbound-events capability. */
const definition = new ConfigurableModuleBuilder<InboundEventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    InboundEventsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: InboundEventsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
