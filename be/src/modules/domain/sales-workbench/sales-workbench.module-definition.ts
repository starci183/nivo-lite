import { defineCapabilityModule } from "@starci/nest-kit"
import type { SalesWorkbenchOptions } from "./sales-workbench.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SalesWorkbenchOptions>()
