import { defineCapabilityModule } from "@starci/nest-kit"
import type { AuthorityRulesOptions } from "./authority-rules.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AuthorityRulesOptions>()
