import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetOperatingModeRequest } from "./set-operating-mode.contracts"

/** Asks to set how an agent runs. */
export class SetOperatingModeCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<SetOperatingModeRequest>) {
        super()
    }
}
