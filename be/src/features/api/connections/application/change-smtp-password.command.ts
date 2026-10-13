import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChangeSmtpPasswordRequest } from "./change-smtp-password.contracts"

/** Replaces the password of an SMTP connection. */
export class ChangeSmtpPasswordCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChangeSmtpPasswordRequest>) {
        super()
    }
}
