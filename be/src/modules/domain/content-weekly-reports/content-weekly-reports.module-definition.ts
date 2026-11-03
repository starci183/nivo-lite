import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentWeeklyReportsOptions } from "./content-weekly-reports.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentWeeklyReportsOptions>()
