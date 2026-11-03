import { defineConfigurableModule } from "@starci/nest-kit"
import type { TemplateMarketplaceGraphqlOptions } from "./template-marketplace-graphql.options"

/** The configurable-module base of the template-marketplace-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TemplateMarketplaceGraphqlOptions>()
