import { defineCapabilityModule } from "@starci/nest-kit"
import type { ImageOptions } from "./image.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ImageOptions>({
    optionsInjectionToken: Symbol("integrations.image.options"),
})
