import { defineCapabilityModule } from "@starci/nest-kit"
import type { NodeRightRollupsOptions } from "./node-right-rollups.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<NodeRightRollupsOptions>()
