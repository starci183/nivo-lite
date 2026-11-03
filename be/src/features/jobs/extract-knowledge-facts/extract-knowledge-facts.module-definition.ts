import { defineConfigurableModule } from "@starci/nest-kit"
import type { ExtractKnowledgeFactsOptions } from "./extract-knowledge-facts.options"

/** The configurable-module base of the extract-knowledge-facts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ExtractKnowledgeFactsOptions>()
