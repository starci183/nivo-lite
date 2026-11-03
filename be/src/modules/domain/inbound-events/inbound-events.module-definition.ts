import { defineCapabilityModule } from "@starci/nest-kit"
import type { InboundEventsOptions } from "./inbound-events.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<InboundEventsOptions>()
