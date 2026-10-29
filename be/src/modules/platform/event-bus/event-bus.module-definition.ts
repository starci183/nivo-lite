import { ConfigurableModuleBuilder } from "@nestjs/common"
import { EVENT_BUS_OPTIONS } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EventBusOptions>({
    optionsInjectionToken: EVENT_BUS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
