import { defineCapabilityModule } from "@starci/nest-kit"
import type { OfficeRoomsOptions } from "./office-rooms.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OfficeRoomsOptions>()
