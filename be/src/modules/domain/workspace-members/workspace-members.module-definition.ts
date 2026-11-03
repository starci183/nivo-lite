import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkspaceMembersOptions } from "./workspace-members.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceMembersOptions>()
