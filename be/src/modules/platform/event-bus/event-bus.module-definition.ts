import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { EVENT_BUS_OPTIONS } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"

const definition = new ConfigurableModuleBuilder<EventBusOptions>({
    optionsInjectionToken: EVENT_BUS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    EventBusOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: EventBusOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
