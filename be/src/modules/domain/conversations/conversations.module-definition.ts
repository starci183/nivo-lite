import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConversationsOptions } from "./conversations.options"

/** The configurable-module base of the conversations capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConversationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
