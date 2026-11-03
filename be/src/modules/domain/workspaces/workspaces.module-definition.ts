import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkspacesOptions } from "./workspaces.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspacesOptions>()
