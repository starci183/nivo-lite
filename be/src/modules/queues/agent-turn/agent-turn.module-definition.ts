import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentTurnOptions } from "./agent-turn.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentTurnOptions>()
