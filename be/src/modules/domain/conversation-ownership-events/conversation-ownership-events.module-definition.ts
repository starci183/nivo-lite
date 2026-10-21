import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConversationOwnershipEventsOptions } from "./conversation-ownership-events.options"

/** Configurable-module base for the conversation-ownership-events capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConversationOwnershipEventsOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
