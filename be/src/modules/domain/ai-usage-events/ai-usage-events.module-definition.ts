import { defineCapabilityModule } from "@starci/nest-kit"
import type { AiUsageEventsOptions } from "./ai-usage-events.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiUsageEventsOptions>()
