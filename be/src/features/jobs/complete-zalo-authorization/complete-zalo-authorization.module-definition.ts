import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CompleteZaloAuthorizationOptions } from "./complete-zalo-authorization.options"

/** The configurable-module base of the complete-zalo-authorization module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CompleteZaloAuthorizationOptions>().setClassMethodName("register").build()
