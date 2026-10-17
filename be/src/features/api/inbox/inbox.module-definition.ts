import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxApiOptions } from "./inbox.options"

/** The configurable-module base of the inbox module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InboxApiOptions>().setClassMethodName("register").build()
