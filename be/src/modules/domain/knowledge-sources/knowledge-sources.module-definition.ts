import { defineCapabilityModule } from "@starci/nest-kit"
import type { KnowledgeSourcesOptions } from "./knowledge-sources.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<KnowledgeSourcesOptions>()
