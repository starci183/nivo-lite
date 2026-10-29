import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ThreadOutcomesMessageOptions } from "./thread-outcomes-message.options"

/** The configurable-module base of the thread-outcomes-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ThreadOutcomesMessageOptions>().setClassMethodName("register").build()
