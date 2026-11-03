import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TemplateMarketplaceApiOptions } from "./template-marketplace.options"

/** The configurable-module base of the template-marketplace feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TemplateMarketplaceApiOptions>().setClassMethodName("register").build()
