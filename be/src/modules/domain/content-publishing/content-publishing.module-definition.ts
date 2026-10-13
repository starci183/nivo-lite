import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentPublishingOptions } from "./content-publishing.options"

/** The app root decides whether publishing is available globally. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentPublishingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
