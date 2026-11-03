import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentPublishingOptions } from "./content-publishing.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentPublishingOptions>()
