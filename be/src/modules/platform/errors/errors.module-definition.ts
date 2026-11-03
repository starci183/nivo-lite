import { defineCapabilityModule } from "@starci/nest-kit"
import { ERRORS_OPTIONS } from "./errors.decorators"
import type { ErrorsOptions } from "./errors.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<ErrorsOptions>({
    optionsInjectionToken: ERRORS_OPTIONS,
})
