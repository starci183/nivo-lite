import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeApiOptions } from "./office.options"

/** The configurable-module base of the office module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OfficeApiOptions>().setClassMethodName("register").build()
