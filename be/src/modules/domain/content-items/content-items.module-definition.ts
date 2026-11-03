import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentItemsOptions } from "./content-items.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentItemsOptions>()
