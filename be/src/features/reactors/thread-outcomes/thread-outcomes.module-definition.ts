import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ThreadOutcomesOptions } from "./thread-outcomes.options"

/** The configurable-module base of the thread-outcomes module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ThreadOutcomesOptions>().setClassMethodName("register").build()
