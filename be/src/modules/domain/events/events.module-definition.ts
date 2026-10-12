import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EventsOptions } from "./events.options"

/** The configurable-module base of the events capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
