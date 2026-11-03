import { defineCapabilityModule } from "@starci/nest-kit"
import type { EventsOptions } from "./events.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EventsOptions>()
