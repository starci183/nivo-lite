import { Command } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetOperatingModeRequest } from "./set-operating-mode.contracts"

/** Asks to set how an agent runs. */
export class SetOperatingModeCommand extends Command<InstallationRecord> {
    constructor(readonly params: ExecuteParams<SetOperatingModeRequest>) {
        super()
    }
}
