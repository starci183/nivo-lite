import { defineCapabilityModule } from "@starci/nest-kit"
import type { CqrsOptions } from "./cqrs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CqrsOptions>()
