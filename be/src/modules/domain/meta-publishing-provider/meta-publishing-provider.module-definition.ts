import { defineCapabilityModule } from "@starci/nest-kit"
import type { MetaPublishingProviderOptions } from "./meta-publishing-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MetaPublishingProviderOptions>()
