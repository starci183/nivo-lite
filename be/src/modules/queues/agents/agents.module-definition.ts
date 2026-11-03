import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentsQueueOptions } from "./agents.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentsQueueOptions>()
