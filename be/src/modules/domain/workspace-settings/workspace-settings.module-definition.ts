import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkspaceSettingsOptions } from "./workspace-settings.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceSettingsOptions>()
