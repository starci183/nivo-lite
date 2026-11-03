import { defineCapabilityModule } from "@starci/nest-kit"
import type { GraphqlOptions } from "./graphql.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<GraphqlOptions>()
