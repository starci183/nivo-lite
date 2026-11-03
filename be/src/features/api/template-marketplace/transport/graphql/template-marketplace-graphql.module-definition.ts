import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleCls, ConfigurableModuleHost } from "@nestjs/common"
import type { TemplateMarketplaceGraphqlOptions } from "./template-marketplace-graphql.options"

const definition: ConfigurableModuleHost<
    TemplateMarketplaceGraphqlOptions,
    "register",
    "create",
    Record<never, never>
> = new ConfigurableModuleBuilder<TemplateMarketplaceGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the module. */
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TemplateMarketplaceGraphqlOptions,
    "register",
    "create",
    Record<never, never>
> = definition.ConfigurableModuleClass

/** The token of the options of the module. */
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN

/** The type of the options the module registers with. */
export const OPTIONS_TYPE: TemplateMarketplaceGraphqlOptions = definition.OPTIONS_TYPE
