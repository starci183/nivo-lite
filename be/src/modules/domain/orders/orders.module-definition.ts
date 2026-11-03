import { defineCapabilityModule } from "@starci/nest-kit"
import type { OrdersOptions } from "./orders.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OrdersOptions>()
