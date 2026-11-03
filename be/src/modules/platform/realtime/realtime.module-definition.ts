import { defineCapabilityModule } from "@starci/nest-kit"
import { REALTIME_OPTIONS } from "./realtime.decorators"
import type { RealtimeOptions } from "./realtime.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<RealtimeOptions>({
    optionsInjectionToken: REALTIME_OPTIONS,
})
