import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxSimulationApiOptions } from "./inbox-simulation.options"

/** The configurable-module base of the inbox-simulation module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InboxSimulationApiOptions>().setClassMethodName("register").build()
