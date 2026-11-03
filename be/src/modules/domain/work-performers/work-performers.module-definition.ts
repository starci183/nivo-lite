import { defineCapabilityModule } from "@starci/nest-kit"
import { WORK_PERFORMERS_OPTIONS } from "./work-performers.decorators"
import type { WorkPerformersOptions } from "./work-performers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkPerformersOptions>({
    optionsInjectionToken: WORK_PERFORMERS_OPTIONS,
})
