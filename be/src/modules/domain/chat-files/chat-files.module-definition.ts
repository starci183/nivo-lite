import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatFilesOptions } from "./chat-files.options"

/** The chat-files module base; the app root decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatFilesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
