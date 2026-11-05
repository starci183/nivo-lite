import { defineConfigurableModule } from "@starci/nest-kit"
import type { EntitySchemaOptions } from "./entity-schema.options"

/** The configurable-module base of the entities module. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineConfigurableModule<EntitySchemaOptions>()
