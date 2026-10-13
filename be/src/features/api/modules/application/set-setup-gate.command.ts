import { Command } from "@nestjs/cqrs"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetSetupGateRequest } from "./set-setup-gate.contracts"

/** Asks to confirm, reopen or edit one gate of the open draft. */
export class SetSetupGateCommand extends Command<SetupSessionRecord> {
    constructor(readonly params: ExecuteParams<SetSetupGateRequest>) {
        super()
    }
}
