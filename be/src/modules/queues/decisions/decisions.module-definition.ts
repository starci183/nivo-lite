import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DecisionsQueueOptions } from "./decisions.options"

/** The configurable-module base of the decisions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DecisionsQueueOptions>().setClassMethodName("register").build()
