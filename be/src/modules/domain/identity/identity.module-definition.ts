import { defineCapabilityModule } from "@starci/nest-kit"
import type { IdentityOptions } from "./identity.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<IdentityOptions>()
