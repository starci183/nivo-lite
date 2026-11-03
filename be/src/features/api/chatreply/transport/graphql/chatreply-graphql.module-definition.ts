import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatReplyGraphqlOptions } from "./chatreply-graphql.options"

/** The configurable-module base of the chatreply-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatReplyGraphqlOptions>()
