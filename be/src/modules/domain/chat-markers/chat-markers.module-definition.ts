import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatMarkersOptions } from "./chat-markers.options"

/** Configurable-module base of the chat state capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatMarkersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
