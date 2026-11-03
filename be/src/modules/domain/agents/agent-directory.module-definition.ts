import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentDirectoryOptions } from "./agent-directory.options"

export const { ConfigurableModuleClass } = defineConfigurableModule<AgentDirectoryOptions>()
