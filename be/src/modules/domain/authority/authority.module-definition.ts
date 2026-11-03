import { defineCapabilityModule } from "@starci/nest-kit"
import type { AuthorityOptions } from "./authority.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AuthorityOptions>()
