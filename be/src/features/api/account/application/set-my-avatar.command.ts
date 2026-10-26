import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetMyAvatarRequest } from "./set-my-avatar.contracts"

/** Asks to keep an uploaded picture on the caller's account, or to remove it. */
export class SetMyAvatarCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetMyAvatarRequest>) {
        super()
    }
}
