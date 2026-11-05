import { defineCapabilityModule } from "@starci/nest-kit"
import { CONNECTION_POLL_OPTIONS } from "./connection-poll.decorators"
import type { ConnectionPollOptions } from "./connection-poll.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionPollOptions>({
    optionsInjectionToken: CONNECTION_POLL_OPTIONS,
})
