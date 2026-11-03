import { defineCapabilityModule } from "@starci/nest-kit"
import { CONNECTION_POLL_OPTIONS } from "./connection-poll.decorators"
import type { ConnectionPollOptions } from "./poll-schedule.contracts"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionPollOptions>({
    optionsInjectionToken: CONNECTION_POLL_OPTIONS,
})
