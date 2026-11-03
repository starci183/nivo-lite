import { defineCapabilityModule } from "@starci/nest-kit"
import type { OverviewOptions } from "./overview.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OverviewOptions>()
