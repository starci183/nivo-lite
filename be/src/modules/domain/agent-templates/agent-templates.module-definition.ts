import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentTemplatesOptions } from "./agent-templates.options"

/** The configurable module base of the agent-templates capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentTemplatesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
