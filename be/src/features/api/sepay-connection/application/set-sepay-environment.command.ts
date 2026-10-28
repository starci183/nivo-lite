import { Command } from "@nestjs/cqrs"
import type { SepayConnectionView } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetSepayEnvironmentRequest } from "./set-sepay-environment.contracts"

/** Switches a SePay connection between test and live. */
export class SetSepayEnvironmentCommand extends Command<SepayConnectionView> {
    constructor(readonly params: ExecuteParams<SetSepayEnvironmentRequest>) {
        super()
    }
}
