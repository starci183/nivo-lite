import { defineCapabilityModule } from "@starci/nest-kit"
import type { IntentContractsOptions } from "./intent-contracts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<IntentContractsOptions>()
