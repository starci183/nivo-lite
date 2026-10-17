import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesWorkbenchApiOptions } from "./sales-workbench.options"

/** The configurable-module base of the sales-workbench module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SalesWorkbenchApiOptions>().setClassMethodName("register").build()
