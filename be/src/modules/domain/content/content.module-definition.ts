import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentOptions } from "./content.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentOptions>()
