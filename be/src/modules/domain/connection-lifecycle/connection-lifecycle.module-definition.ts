import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConnectionLifecycleOptions } from "./connection-lifecycle.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionLifecycleOptions>()
