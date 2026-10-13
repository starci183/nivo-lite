import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoBrandKitsOptions } from "./video-brand-kits.options"

/** The configurable-module base of workspace video kits. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoBrandKitsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
