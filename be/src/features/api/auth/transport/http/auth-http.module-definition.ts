import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AuthHttpOptions } from "./auth-http.options"

/** The configurable-module base of the auth-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AuthHttpOptions>().setClassMethodName("register").build()
