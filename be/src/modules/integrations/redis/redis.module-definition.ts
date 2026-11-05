import { defineCapabilityModule } from "@starci/nest-kit"
import type { RedisOptions } from "./redis.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<RedisOptions>()
