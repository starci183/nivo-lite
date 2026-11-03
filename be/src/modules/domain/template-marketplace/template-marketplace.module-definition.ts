import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleCls, ConfigurableModuleHost } from "@nestjs/common"
import type { TemplateMarketplaceOptions } from "./template-marketplace.options"

/** The extras the capability registers with: whether it is global. */
type Extras = { isGlobal: boolean }

const definition: ConfigurableModuleHost<TemplateMarketplaceOptions, "register", "create", Extras> =
    new ConfigurableModuleBuilder<TemplateMarketplaceOptions>()
        .setExtras<Extras>({ isGlobal: false }, (module, extras) => ({ ...module, global: extras.isGlobal }))
        .build()

/** The configurable-module base of the capability. */
export const ConfigurableModuleClass: ConfigurableModuleCls<TemplateMarketplaceOptions, "register", "create", Extras> =
    definition.ConfigurableModuleClass

/** The type of the options the capability registers with. */
export const OPTIONS_TYPE: TemplateMarketplaceOptions & Partial<Extras> = definition.OPTIONS_TYPE
