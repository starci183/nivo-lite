import { defineCapabilityModule } from "@starci/nest-kit"
import type { KnowledgeChunksOptions } from "./knowledge-chunks.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<KnowledgeChunksOptions>()
