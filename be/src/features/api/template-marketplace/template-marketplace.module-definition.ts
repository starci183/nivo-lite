import { defineConfigurableModule } from "@starci/nest-kit"
import type { TemplateMarketplaceApiOptions } from "./template-marketplace.options"

/** The configurable-module base of the template-marketplace feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TemplateMarketplaceApiOptions>()
