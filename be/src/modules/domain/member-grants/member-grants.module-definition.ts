import { defineCapabilityModule } from "@starci/nest-kit"
import type { MemberGrantsOptions } from "./member-grants.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MemberGrantsOptions>()
