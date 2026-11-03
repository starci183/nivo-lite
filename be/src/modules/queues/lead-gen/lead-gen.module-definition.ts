import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadGenQueueOptions } from "./lead-gen.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadGenQueueOptions>()
