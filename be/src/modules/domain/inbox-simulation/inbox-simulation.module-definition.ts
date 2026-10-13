import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxSimulationOptions } from "./inbox-simulation.options"

/** The simulator orchestration's configurable module definition. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboxSimulationOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
