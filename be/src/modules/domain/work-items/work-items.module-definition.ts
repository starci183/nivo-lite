import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkItemsOptions } from "./work-items.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkItemsOptions>()
