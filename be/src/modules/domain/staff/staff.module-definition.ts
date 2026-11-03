import { defineCapabilityModule } from "@starci/nest-kit"
import type { StaffOptions } from "./staff.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<StaffOptions>()
