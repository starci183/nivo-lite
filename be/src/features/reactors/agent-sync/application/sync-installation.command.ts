import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SyncInstallationRequest } from "./sync-installation.contracts"

/** Asks to apply one delivered installation_changed event; the installation_changed consumer sends it for every delivery. */
export class SyncInstallationCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SyncInstallationRequest>) {
        super()
    }
}
