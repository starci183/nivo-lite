import { Command } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetModuleLiveRequest } from "./set-module-live.contracts"

/** Asks to switch an agent live or paused. */
export class SetModuleLiveCommand extends Command<InstallationView> {
    constructor(readonly params: ExecuteParams<SetModuleLiveRequest>) {
        super()
    }
}
