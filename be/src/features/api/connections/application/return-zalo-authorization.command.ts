import { Command } from "@nestjs/cqrs"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReturnZaloAuthorizationRequest } from "./return-zalo-authorization.contracts"

/** Finishes the Zalo sign-in with what Zalo returned the browser with. */
export class ReturnZaloAuthorizationCommand extends Command<ZaloWizardConnection> {
    constructor(readonly params: ExecuteParams<ReturnZaloAuthorizationRequest>) {
        super()
    }
}
