import { ConfigurableModuleBuilder } from "@nestjs/common"
import { REALTIME_OPTIONS } from "./realtime.decorators"
import type { RealtimeOptions } from "./realtime.options"

/** The configurable-module base of the realtime capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RealtimeOptions>({
    optionsInjectionToken: REALTIME_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
