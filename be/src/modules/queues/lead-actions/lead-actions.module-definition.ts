import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadActionsQueueOptions } from "./lead-actions.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadActionsQueueOptions>()
