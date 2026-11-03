import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { REALTIME_OPTIONS } from "./realtime.decorators"
import type { RealtimeOptions } from "./realtime.options"

/** The configurable-module base of the realtime capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<RealtimeOptions>({
    optionsInjectionToken: REALTIME_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    RealtimeOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: RealtimeOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
