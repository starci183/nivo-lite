import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChattypingGraphqlOptions } from "./chattyping-graphql.options"

/** The configurable-module base of the typing GraphQL transport. */
export const { ConfigurableModuleClass } = defineConfigurableModule<ChattypingGraphqlOptions>()
