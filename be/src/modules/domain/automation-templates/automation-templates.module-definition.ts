import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationTemplatesOptions } from "./automation-templates.options"

/** The configurable-module base of the automation templates. */
const definition = new ConfigurableModuleBuilder<AutomationTemplatesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationTemplatesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationTemplatesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
