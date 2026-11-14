import { defineCapabilityModule } from "@starci/nest-kit"
import type { VectorSyncOptions } from "./vector-sync.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VectorSyncOptions>()
