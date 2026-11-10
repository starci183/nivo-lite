import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkspaceDashboardOptions } from "./workspace-dashboard.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceDashboardOptions>()
