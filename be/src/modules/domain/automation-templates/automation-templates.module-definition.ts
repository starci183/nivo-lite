import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationTemplatesOptions } from "./automation-templates.options"

/** The configurable-module base of the automation templates. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationTemplatesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
