import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkThreadsApiOptions } from "./work-threads.options"

/** The configurable-module base of the work-threads feature module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WorkThreadsApiOptions>().setClassMethodName("register").build()
