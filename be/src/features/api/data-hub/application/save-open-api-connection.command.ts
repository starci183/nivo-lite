import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveOpenApiConnectionRequest } from "./save-open-api-connection.contracts"

/** Creates or updates an API connection; answers its id. */
export class SaveOpenApiConnectionCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<SaveOpenApiConnectionRequest>) {
        super()
    }
}
