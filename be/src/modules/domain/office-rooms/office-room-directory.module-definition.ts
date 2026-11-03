import { defineConfigurableModule } from "@starci/nest-kit"
import type { OfficeRoomDirectoryOptions } from "./office-room-directory.options"

export const { ConfigurableModuleClass } = defineConfigurableModule<OfficeRoomDirectoryOptions>()
