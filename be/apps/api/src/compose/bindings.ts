import type { DynamicModule } from "@nestjs/common"
import { AppCommandsModule } from "@modules/domain/app-commands"
import { ContractsModule } from "@modules/domain/contracts"
import { LivenessModule } from "@modules/domain/liveness"

/** Register the app-wide system capabilities. */
export const systemCapabilities = (): Array<DynamicModule> => [
    AppCommandsModule.register({ isGlobal: true }),
    ContractsModule.register({ isGlobal: true }),
    LivenessModule.register({ isGlobal: true }),
]
