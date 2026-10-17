import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AdminApiOptions } from "./admin.options"

/** The configurable-module base of the admin module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AdminApiOptions>().setClassMethodName("register").build()
