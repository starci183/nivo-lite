import { Command } from "@nestjs/cqrs"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveZaloOaSecretRequest } from "./save-zalo-oa-secret.contracts"

/** Seals the OA Secret Key of a Zalo connection. */
export class SaveZaloOaSecretCommand extends Command<ZaloWizardConnection> {
    constructor(readonly params: ExecuteParams<SaveZaloOaSecretRequest>) {
        super()
    }
}
