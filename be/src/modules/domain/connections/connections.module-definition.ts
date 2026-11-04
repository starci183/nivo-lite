import { defineCapabilityModule } from "@starci/nest-kit"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import type { ConnectionsModuleOptions } from "./connections.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<ConnectionsModuleOptions>({
        optionsInjectionToken: CONNECTIONS_OPTIONS,
    })
