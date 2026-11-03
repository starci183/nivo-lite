import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatTurnOptions } from "./chat-turn.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatTurnOptions>()
