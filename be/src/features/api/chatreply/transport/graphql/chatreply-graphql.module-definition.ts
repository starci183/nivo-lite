import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatReplyGraphqlOptions } from "./chatreply-graphql.options"

/** The configurable-module base of the chatreply-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatReplyGraphqlOptions>().setClassMethodName("register").build()
