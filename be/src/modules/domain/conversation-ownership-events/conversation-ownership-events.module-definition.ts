import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConversationOwnershipEventsOptions } from "./conversation-ownership-events.options"

/** Configurable-module base for the conversation-ownership-events capability. */
const definition = new ConfigurableModuleBuilder<ConversationOwnershipEventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConversationOwnershipEventsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConversationOwnershipEventsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
