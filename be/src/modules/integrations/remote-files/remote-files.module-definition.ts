import { defineCapabilityModule } from "@starci/nest-kit"
import type { RemoteFilesOptions } from "./remote-files.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<RemoteFilesOptions>()
