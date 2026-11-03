import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicApiQueueOptions } from "./public-api.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicApiQueueOptions>()
