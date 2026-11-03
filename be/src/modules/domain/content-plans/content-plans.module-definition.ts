import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentPlansOptions } from "./content-plans.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentPlansOptions>()
