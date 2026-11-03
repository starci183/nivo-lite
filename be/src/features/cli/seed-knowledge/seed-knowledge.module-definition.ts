import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedKnowledgeOptions } from "./seed-knowledge.options"

/** The configurable-module base of the seed-knowledge module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedKnowledgeOptions>()
