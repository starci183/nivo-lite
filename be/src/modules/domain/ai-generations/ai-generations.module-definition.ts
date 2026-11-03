import { defineCapabilityModule } from "@starci/nest-kit"
import type { AiGenerationsOptions } from "./ai-generations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiGenerationsOptions>()
