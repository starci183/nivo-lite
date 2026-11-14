import { Command } from "@nestjs/cqrs"
import type { CrmConnectionResult } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveCrmConnectionRequest } from "./save-crm-connection.contracts"

/** Connects or updates a CRM provider via OpenAPI; answers the compatibility of its live document. */
export class SaveCrmConnectionCommand extends Command<CrmConnectionResult> {
    constructor(readonly params: ExecuteParams<SaveCrmConnectionRequest>) {
        super()
    }
}
