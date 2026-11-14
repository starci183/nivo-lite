import { defineCapabilityModule } from "@starci/nest-kit"
import { QDRANT_OPTIONS } from "./qdrant.decorators"
import type { QdrantOptions } from "./qdrant.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<QdrantOptions>({
    optionsInjectionToken: QDRANT_OPTIONS,
})
