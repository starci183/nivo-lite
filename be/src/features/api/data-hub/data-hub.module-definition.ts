import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataHubApiOptions } from "./data-hub.options"

/** The configurable-module base of the data-hub module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataHubApiOptions>().setClassMethodName("register").build()
