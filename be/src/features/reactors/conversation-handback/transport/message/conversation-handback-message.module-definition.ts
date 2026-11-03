import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ConversationHandbackMessageOptions } from "./conversation-handback-message.options"

type Host = ConfigurableModuleHost<ConversationHandbackMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ConversationHandbackMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the conversation-handback-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the conversation-handback-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the conversation-handback-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
