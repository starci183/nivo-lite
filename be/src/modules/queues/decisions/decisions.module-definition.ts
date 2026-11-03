import { defineConfigurableModule } from "@starci/nest-kit"
import type { DecisionsQueueOptions } from "./decisions.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DecisionsQueueOptions>()
