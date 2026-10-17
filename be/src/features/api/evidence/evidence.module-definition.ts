import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EvidenceApiOptions } from "./evidence.options"

/** The configurable-module base of the evidence module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<EvidenceApiOptions>().setClassMethodName("register").build()
