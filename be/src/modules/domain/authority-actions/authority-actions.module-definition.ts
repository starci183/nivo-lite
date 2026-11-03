import { defineCapabilityModule } from "@starci/nest-kit"
import type { AuthorityActionsOptions } from "./authority-actions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AuthorityActionsOptions>()
