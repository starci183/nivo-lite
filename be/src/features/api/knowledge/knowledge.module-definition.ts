import { defineConfigurableModule } from "@starci/nest-kit"
import type { KnowledgeApiOptions } from "./knowledge.options"

/** The configurable-module base of the knowledge module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<KnowledgeApiOptions>()
