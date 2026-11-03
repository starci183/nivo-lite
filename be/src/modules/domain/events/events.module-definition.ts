import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { EventsOptions } from "./events.options"

/** The configurable-module base of the events capability. */
const definition = new ConfigurableModuleBuilder<EventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    EventsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: EventsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
