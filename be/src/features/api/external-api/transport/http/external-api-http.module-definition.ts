import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ExternalApiHttpOptions } from "./external-api-http.options"

/** The configurable-module base of the external-api-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ExternalApiHttpOptions>().setClassMethodName("register").build()
