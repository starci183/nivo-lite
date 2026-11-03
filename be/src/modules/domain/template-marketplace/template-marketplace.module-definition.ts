import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TemplateMarketplaceOptions } from "./template-marketplace.options"

/** The configurable module base of the template-marketplace capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TemplateMarketplaceOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
