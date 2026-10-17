import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GenerateWithAgentOptions } from "./generate-with-agent.options"

/** The configurable-module base of the generate-with-agent module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GenerateWithAgentOptions>().setClassMethodName("register").build()
