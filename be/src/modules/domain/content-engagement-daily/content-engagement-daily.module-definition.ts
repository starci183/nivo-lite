import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentEngagementDailyOptions } from "./content-engagement-daily.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentEngagementDailyOptions>()
