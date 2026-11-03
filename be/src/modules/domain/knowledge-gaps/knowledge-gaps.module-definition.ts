import { defineCapabilityModule } from "@starci/nest-kit"
import type { KnowledgeGapsOptions } from "./knowledge-gaps.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<KnowledgeGapsOptions>()
