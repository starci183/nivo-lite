import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AvatarsOptions } from "./avatars.options"

/** The avatars module base; the app root decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AvatarsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
