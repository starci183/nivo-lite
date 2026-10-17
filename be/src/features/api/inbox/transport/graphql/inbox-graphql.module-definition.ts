import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxGraphqlOptions } from "./inbox-graphql.options"

/** The configurable-module base of the inbox-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InboxGraphqlOptions>().setClassMethodName("register").build()
