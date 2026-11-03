import { defineConfigurableModule } from "@starci/nest-kit"
import type { KnowledgeProgressSseOptions } from "./knowledge-progress-sse.options"

/** The configurable-module base of the knowledge-progress-sse module. */
export const { ConfigurableModuleClass } = defineConfigurableModule<KnowledgeProgressSseOptions>()
