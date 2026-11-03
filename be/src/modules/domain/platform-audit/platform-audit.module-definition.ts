import { defineCapabilityModule } from "@starci/nest-kit"
import type { PlatformAuditOptions } from "./platform-audit.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PlatformAuditOptions>()
