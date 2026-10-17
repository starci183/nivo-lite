import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ApiCredentialsOptions } from "./api-credentials.options"

/** The configurable base for app credential admission. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ApiCredentialsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
