import { defineCapabilityModule } from "@starci/nest-kit"
import type { SupplierPayablesOptions } from "./supplier-payables.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SupplierPayablesOptions>()
