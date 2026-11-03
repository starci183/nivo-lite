import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceInvitesOptions>()
