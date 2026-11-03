import { defineCapabilityModule } from "@starci/nest-kit"
import { DATABASE_OPTIONS } from "./database.port"
import type { DatabaseOptions } from "./database.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DatabaseOptions>({
    optionsInjectionToken: DATABASE_OPTIONS,
})
