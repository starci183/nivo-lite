import { defineCapabilityModule } from "@starci/nest-kit"
import { LANGGRAPH_OPTIONS } from "./langgraph.decorators"
import type { LanggraphOptions } from "./langgraph.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LanggraphOptions>({
    optionsInjectionToken: LANGGRAPH_OPTIONS,
})
