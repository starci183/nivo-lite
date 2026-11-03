import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContractsOptions } from "./contracts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContractsOptions>()
