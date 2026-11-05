import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkbenchDoorOptions>()
