import { defineCapabilityModule } from "@starci/nest-kit"
import type { CustomerRoutesOptions } from "./customer-routes.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CustomerRoutesOptions>()
