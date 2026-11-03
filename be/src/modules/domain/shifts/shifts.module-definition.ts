import { defineCapabilityModule } from "@starci/nest-kit"
import type { ShiftsOptions } from "./shifts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ShiftsOptions>()
