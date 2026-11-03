import { defineCapabilityModule } from "@starci/nest-kit"
import type { ClockOptions } from "./clock.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ClockOptions>()
