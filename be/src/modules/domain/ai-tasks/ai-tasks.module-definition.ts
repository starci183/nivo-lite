import { defineCapabilityModule } from "@starci/nest-kit"
import type { AiTasksWiring } from "./ai-tasks.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiTasksWiring>()
