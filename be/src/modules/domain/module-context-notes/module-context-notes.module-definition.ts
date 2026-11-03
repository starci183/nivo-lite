import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContextNotesOptions } from "./module-context-notes.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContextNotesOptions>()
