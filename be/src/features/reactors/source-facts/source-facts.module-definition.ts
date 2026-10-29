import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SourceFactsOptions } from "./source-facts.options"

/** The configurable-module base of the source-facts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SourceFactsOptions>().setClassMethodName("register").build()
