import { defineCapabilityModule } from "@starci/nest-kit"
import type { WebsiteIntakeOptions } from "./website-intake.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WebsiteIntakeOptions>()
