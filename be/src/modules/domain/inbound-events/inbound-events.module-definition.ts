import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboundEventsOptions } from "./inbound-events.options"

/** The configurable-module base of the inbound-events capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboundEventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
