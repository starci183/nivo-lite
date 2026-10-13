import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentSettingsOptions } from "./content-settings.options"

/** The configurable-module base of the content-settings capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentSettingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
