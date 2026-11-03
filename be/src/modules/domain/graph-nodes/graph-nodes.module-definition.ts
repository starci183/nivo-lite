import { defineCapabilityModule } from "@starci/nest-kit"
import type { GraphNodesOptions } from "./graph-nodes.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<GraphNodesOptions>()
