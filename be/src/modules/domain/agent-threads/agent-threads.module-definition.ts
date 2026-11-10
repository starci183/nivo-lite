import { defineCapabilityModule } from "@starci/nest-kit"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import type { AgentThreadsOptions } from "./agent-threads.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentThreadsOptions>({
    optionsInjectionToken: AGENT_THREADS_OPTIONS,
})
