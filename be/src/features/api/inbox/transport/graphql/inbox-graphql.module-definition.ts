import { defineConfigurableModule } from "@starci/nest-kit"
import type { InboxGraphqlOptions } from "./inbox-graphql.options"

/** The configurable-module base of the inbox-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InboxGraphqlOptions>()
