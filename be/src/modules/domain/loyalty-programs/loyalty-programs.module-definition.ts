import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyProgramsOptions } from "./loyalty-programs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyProgramsOptions>()
