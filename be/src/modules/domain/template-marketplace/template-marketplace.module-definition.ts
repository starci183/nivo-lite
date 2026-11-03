import { defineCapabilityModule } from "@starci/nest-kit"
import type { TemplateMarketplaceOptions } from "./template-marketplace.options"

/** The configurable module base of the template-marketplace capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TemplateMarketplaceOptions>()
