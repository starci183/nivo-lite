import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SeedKnowledgeOptions } from "./seed-knowledge.options"

/** The configurable-module base of the seed-knowledge module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SeedKnowledgeOptions>().setClassMethodName("register").build()
