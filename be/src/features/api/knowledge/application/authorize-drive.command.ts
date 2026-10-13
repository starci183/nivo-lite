import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AuthorizeDriveRequest, AuthorizeDriveResult } from "./authorize-drive.contracts"

/** Starts the Google Drive read consent. */
export class AuthorizeDriveCommand extends Command<AuthorizeDriveResult> {
    constructor(readonly params: ExecuteParams<AuthorizeDriveRequest>) {
        super()
    }
}
