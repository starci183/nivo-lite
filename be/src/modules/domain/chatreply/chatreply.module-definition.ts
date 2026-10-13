import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatReplyOptions } from "./chatreply.options"

/** The configurable module base of customer reply orchestration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatReplyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
