import { defineCapabilityModule } from "@starci/nest-kit"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModulesOptions>({
    optionsInjectionToken: MODULES_OPTIONS,
})
