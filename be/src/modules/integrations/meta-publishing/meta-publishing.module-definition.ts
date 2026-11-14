import { defineCapabilityModule } from "@starci/nest-kit"
import { META_PUBLISHING_OPTIONS } from "./meta-publishing.decorators"
import type { MetaPublishingOptions } from "./meta-publishing.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<MetaPublishingOptions>({
    optionsInjectionToken: META_PUBLISHING_OPTIONS,
})
