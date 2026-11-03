import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentPublishingOptions } from "./content-publishing.options"

/** The app root decides whether publishing is available globally. */
const definition = new ConfigurableModuleBuilder<ContentPublishingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentPublishingOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentPublishingOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
