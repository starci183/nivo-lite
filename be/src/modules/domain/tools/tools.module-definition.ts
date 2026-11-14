import { defineCapabilityModule } from "@starci/nest-kit"
import { TOOLS_OPTIONS } from "./tools.decorators"
import type { ToolsOptions } from "./tools.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ToolsOptions>({
    optionsInjectionToken: TOOLS_OPTIONS,
})
