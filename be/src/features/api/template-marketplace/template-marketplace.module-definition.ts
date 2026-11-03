import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleCls, ConfigurableModuleHost } from "@nestjs/common"
import type { TemplateMarketplaceApiOptions } from "./template-marketplace.options"

const definition: ConfigurableModuleHost<
    TemplateMarketplaceApiOptions,
    "register",
    "create",
    Record<never, never>
> = new ConfigurableModuleBuilder<TemplateMarketplaceApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the module. */
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TemplateMarketplaceApiOptions,
    "register",
    "create",
    Record<never, never>
> = definition.ConfigurableModuleClass

/** The token of the options of the module. */
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN

/** The type of the options the module registers with. */
export const OPTIONS_TYPE: TemplateMarketplaceApiOptions = definition.OPTIONS_TYPE
