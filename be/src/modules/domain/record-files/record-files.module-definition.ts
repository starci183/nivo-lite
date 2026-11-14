import { defineCapabilityModule } from "@starci/nest-kit"
import type { RecordFilesOptions } from "./record-files.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<RecordFilesOptions>()
