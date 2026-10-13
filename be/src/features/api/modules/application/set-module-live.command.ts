import { Command } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetModuleLiveRequest } from "./set-module-live.contracts"

/** Asks to switch an agent live or paused. */
export class SetModuleLiveCommand extends Command<InstallationRecord> {
    constructor(readonly params: ExecuteParams<SetModuleLiveRequest>) {
        super()
    }
}
