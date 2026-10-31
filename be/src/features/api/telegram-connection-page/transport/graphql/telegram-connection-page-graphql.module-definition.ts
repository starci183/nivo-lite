import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramConnectionPageGraphqlOptions } from "./telegram-connection-page-graphql.options"

/** The configurable-module base of the telegram-connection-page-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramConnectionPageGraphqlOptions>().setClassMethodName("register").build()
