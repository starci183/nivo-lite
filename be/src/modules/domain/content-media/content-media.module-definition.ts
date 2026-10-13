import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentMediaOptions } from "./content-media.options"

/** The content-media module base; the app root decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentMediaOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
