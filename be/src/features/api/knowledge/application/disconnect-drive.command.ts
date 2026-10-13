import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DisconnectDriveRequest } from "./disconnect-drive.contracts"

/** Forgets the Google Drive read grant of the workspace. */
export class DisconnectDriveCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DisconnectDriveRequest>) {
        super()
    }
}
