import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentSettingsOptions } from "./content-settings.options"

/** The configurable-module base of the content-settings capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ContentSettingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentSettingsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentSettingsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
