import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetDefaultSmtpRequest } from "./set-default-smtp.contracts"

/** Makes a connected SMTP connection the default sender. */
export class SetDefaultSmtpCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetDefaultSmtpRequest>) {
        super()
    }
}
