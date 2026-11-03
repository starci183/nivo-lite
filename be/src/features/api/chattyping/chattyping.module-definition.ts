import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChattypingApiOptions } from "./chattyping.options"

/** The configurable-module base of the typing API feature. */
export const { ConfigurableModuleClass } = defineConfigurableModule<ChattypingApiOptions>()
